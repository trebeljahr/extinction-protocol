import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { smoothDirection } from "../sim/path";
import type { BossVariant, EnemyKind } from "../sim/types";
import { BOSS_VARIANT_MATERIAL, BOSS_VARIANT_TINT, ELITE_TINT_BY_KIND } from "../sim/world";
import { useGame } from "../store";
import { measureVisibleBox } from "./measureModel";

type Props = {
  kind: EnemyKind;
  url: string;
  targetSize: number;
  yOffset?: number;
  baseRotY?: number;
  bob?: boolean;
  clip?: string;
  timeScale?: number;
  // Only matched when kind === "boss". Lets Scene.tsx mount one mesh per
  // biome-themed matriarch variant (each loads a different GLB) so the
  // renderer doesn't need to swap models per-enemy at runtime.
  bossVariant?: BossVariant;
};

// Frost tint target — pale ice blue. Enemies lerp from their base color
// toward this as e.frost climbs from 0 → 1.
const FROST_COLOR = new THREE.Color("#cfe6ff");
const FROST_EMISSIVE = new THREE.Color("#3a6aa0");
// Elite chip blends the kind's per-species elite color into the
// material color and adds a matching emissive rim. Strong enough that
// elite raptors look noticeably crimson, elite armored shimmer with a
// chrome-blue cast, etc. Per-kind colors live in world.ts so wave
// authoring + UI can share them.
const ELITE_TINT_AMOUNT = 0.55;
const ELITE_EMISSIVE_AMOUNT = 0.35;
const cloneAndCaptureBase = (mat: THREE.Material): THREE.Material => {
  const c = mat.clone();
  const std = c as THREE.MeshStandardMaterial;
  if (std.color) std.userData.baseColor = std.color.clone();
  return c;
};

type Item = {
  obj: THREE.Object3D;
  proxy: THREE.Mesh | null;
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip | null;
  // Smoothed visual state — lags `e.pos` / path yaw slightly so corner
  // turns arc instead of teleport+snap. Sim-side `e.pos` stays the
  // source of truth for towers and click hits.
  visX: number;
  visZ: number;
  visYaw: number;
  visInit: boolean;
  // Carries the enemy's leak state from the prior live frame so the
  // render layer can tell a true kill (play death anim) apart from an
  // HQ-impact despawn (just pool — the leak attack pose already played).
  wasLeak: boolean;
  // Death-anim bookkeeping. While `dying`, the item stays mounted at
  // its last-known pose so the Death clip (or tilt-fall fallback) can
  // finish before pooling.
  dying: boolean;
  dyingStart: number;
  dyingDuration: number;
  dyingBaseRotX: number;
  dyingBaseY: number;
};

// Exp-damp half-life (seconds). Lower = snappier, higher = floatier.
// Position halflife is tiny — sim now walks a smoothed polyline so there's
// no waypoint snap to mask, and any larger value pulls the rendered model
// perpendicular-inside the painted lane on curves. Yaw stays a touch
// floatier so corner turns read as a rotation, not an instant flip.
const POS_HALFLIFE = 0.02;
const YAW_HALFLIFE = 0.06;

const dampFactor = (dt: number, halflife: number) => 1 - 0.5 ** (dt / halflife);

const shortAngleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Soft cap on pooled clones per kind. Beyond this we let GC reclaim them
// so a single oversized swarm doesn't pin a permanent ceiling of skinned
// meshes in the scene graph.
const POOL_LIMIT = 16;

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find((c) => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

export const ModelEnemyMesh = ({
  kind,
  url,
  targetSize,
  yOffset = 0,
  baseRotY = 0,
  bob = false,
  clip = "Run",
  timeScale = 1,
  bossVariant,
}: Props) => {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const itemsRef = useRef<Map<number, Item>>(new Map());
  // Stable per-kind elite color — built once and reused for the body
  // lerp every frame so we don't allocate THREE.Color in the inner loop.
  // Variant-tagged boss meshes route through the variant tint table so
  // each biome's matriarch has her own elite glow.
  const eliteTint = useMemo(
    () => new THREE.Color(bossVariant ? BOSS_VARIANT_TINT[bossVariant] : ELITE_TINT_BY_KIND[kind]),
    [kind, bossVariant],
  );
  const matriarchMaterial = bossVariant !== undefined ? BOSS_VARIANT_MATERIAL[bossVariant] : null;
  // Free list of skinned clones from dead-but-recyclable enemies. Reusing
  // is significantly cheaper than another `cloneSkinned + AnimationMixer`,
  // which matters for swarms.
  const poolRef = useRef<Item[]>([]);

  const { normalizedScale, centerXZ, scaledMinY } = useMemo(() => {
    const box = measureVisibleBox(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = targetSize / maxDim;
    return {
      normalizedScale: s,
      centerXZ: { x: center.x * s, z: center.z * s },
      scaledMinY: box.min.y * s,
    };
  }, [scene, targetSize]);

  const activeClip = useMemo(
    () => findClip(animations, clip) ?? findClip(animations, "Walk") ?? animations[0] ?? null,
    [animations, clip],
  );
  const attackClip = useMemo(
    () =>
      findClip(animations, "Attack") ??
      findClip(animations, "Bite") ??
      findClip(animations, "Roar") ??
      null,
    [animations],
  );
  // Optional per-kind Death clip. All shipping GLBs include one (the
  // findClip needle is case-insensitive substring), but we still fall
  // back to a tilt-fall in the dying tick if a future model omits it.
  const deathClip = useMemo(
    () =>
      findClip(animations, "Death") ??
      findClip(animations, "Die") ??
      findClip(animations, "Dead") ??
      null,
    [animations],
  );
  // How long the dying mesh lingers before pooling when no Death clip
  // is available. A real Death clip plays to its full duration instead.
  const DEATH_FALLBACK_SEC = 0.6;
  // Death anims flatten the skeleton — bones swing below the rest-pose
  // bounding-box floor that `scaledMinY` was measured against, so the
  // corpse clips into the ground. Lift the corpse by a small fraction
  // of its visible size as the anim progresses to absorb the dip.
  const deathGroundLift = targetSize * 0.06;

  // Invisible, oversized tap target. Lets users hit the enemy even when
  // their finger lands next to the silhouette — critical on touch. The
  // titan and boss native silhouettes are already huge, so they opt out.
  const useProxy = kind !== "titan" && kind !== "boss";
  const proxyRadius = useMemo(() => Math.max(targetSize * 0.8, 1.0), [targetSize]);
  // Invisible click target — no need for smooth silhouette.
  const proxyGeom = useMemo(
    () => (useProxy ? new THREE.SphereGeometry(proxyRadius, 6, 4) : null),
    [proxyRadius, useProxy],
  );
  const proxyMat = useMemo(
    () =>
      useProxy
        ? new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        : null,
    [useProxy],
  );

  useEffect(
    () => () => {
      proxyGeom?.dispose();
      proxyMat?.dispose();
    },
    [proxyGeom, proxyMat],
  );

  useEffect(
    () => () => {
      const parent = groupRef.current;
      if (!parent) return;
      for (const [, item] of itemsRef.current) {
        item.mixer.stopAllAction();
        parent.remove(item.obj);
        if (item.proxy) parent.remove(item.proxy);
      }
      itemsRef.current.clear();
      for (const item of poolRef.current) {
        item.mixer.stopAllAction();
        parent.remove(item.obj);
        if (item.proxy) parent.remove(item.proxy);
      }
      poolRef.current.length = 0;
    },
    [],
  );

  useFrame((_, delta) => {
    const parent = groupRef.current;
    if (!parent) return;
    const { world } = useGame.getState();
    const frozen = world.status !== "running";

    const live = new Set<number>();
    for (const e of world.enemies) {
      if (e.kind !== kind) continue;
      // Boss meshes are partitioned by variant: each variant owns its own
      // GLB, so the apex apatosaurus mesh shouldn't claim a raptor
      // matriarch entity. When `bossVariant` is unset on Props (kind !==
      // "boss"), this branch is a no-op.
      if (bossVariant !== undefined && e.bossVariant !== bossVariant) continue;
      if (!e.alive) continue;
      live.add(e.id);
      let item = itemsRef.current.get(e.id);
      if (!item) {
        const recycled = poolRef.current.pop();
        if (recycled) {
          // Reuse: update id metadata, restart the animation, unhide.
          recycled.obj.visible = true;
          recycled.obj.userData.enemyId = e.id;
          recycled.obj.userData.enemyMaxHp = e.maxHp;
          recycled.obj.traverse((o) => {
            o.userData.enemyId = e.id;
            o.userData.enemyMaxHp = e.maxHp;
          });
          recycled.mixer.stopAllAction();
          recycled.clip = null;
          if (recycled.proxy) {
            recycled.proxy.visible = true;
            recycled.proxy.userData.enemyId = e.id;
            recycled.proxy.userData.enemyMaxHp = e.maxHp;
          }
          recycled.visInit = false;
          // Pool may have stashed a corpse mid-fall; reset transient
          // death state so the recycled clone runs fresh.
          recycled.wasLeak = false;
          recycled.dying = false;
          recycled.dyingStart = 0;
          recycled.dyingDuration = 0;
          recycled.dyingBaseRotX = 0;
          recycled.dyingBaseY = 0;
          recycled.obj.rotation.x = 0;
          recycled.obj.rotation.z = 0;
          item = recycled;
        } else {
          const obj = cloneSkinned(scene);
          obj.scale.setScalar(normalizedScale);
          obj.userData.enemyId = e.id;
          obj.userData.enemyMaxHp = e.maxHp;
          // Boss draws after environment props so dense trees / rocks
          // can't visually swallow her silhouette during a wave. Shadow
          // still grounds her since shadows render in their own pass.
          const bossOnTop = kind === "boss";
          obj.traverse((o) => {
            o.userData.enemyId = e.id;
            o.userData.enemyMaxHp = e.maxHp;
            if (bossOnTop) o.renderOrder = 10;
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
              // SkeletonUtils.clone shares material references across
              // clones, so mutating .emissive for the hit-flash (and
              // .color for the frost tint) would light up every enemy of
              // this kind. Give each clone its own material, and capture
              // the original base color in userData so the frost lerp can
              // restore it each frame.
              if (Array.isArray(m.material)) {
                m.material = m.material.map((mm) => cloneAndCaptureBase(mm));
              } else if (m.material) {
                m.material = cloneAndCaptureBase(m.material as THREE.Material);
              }
            }
          });
          const mixer = new THREE.AnimationMixer(obj);
          parent.add(obj);

          let proxy: THREE.Mesh | null = null;
          if (proxyGeom && proxyMat) {
            proxy = new THREE.Mesh(proxyGeom, proxyMat);
            proxy.userData.enemyId = e.id;
            proxy.userData.enemyMaxHp = e.maxHp;
            proxy.renderOrder = -1;
            parent.add(proxy);
          }

          item = {
            obj,
            proxy,
            mixer,
            clip: null,
            visX: 0,
            visZ: 0,
            visYaw: 0,
            visInit: false,
            wasLeak: false,
            dying: false,
            dyingStart: 0,
            dyingDuration: 0,
            dyingBaseRotX: 0,
            dyingBaseY: 0,
          };
        }
        itemsRef.current.set(e.id, item);
      }

      const leak = e.leak;
      // Stash for the dead-detection pass: leaked enemies (made it to
      // HQ) skip the death anim — they already played the attack pose
      // and despawning them at the gate looks cleaner without a corpse.
      item.wasLeak = leak !== undefined;
      // Engaged dinos (skirmishing with the hero) also pick the attack
      // clip — same animation, different driver. Falls back to the
      // walk loop if the GLB has no Attack/Bite/Roar clip.
      const engagingHero = !leak && e.engagedHeroId !== null;
      const desiredClip = (leak || engagingHero) && attackClip ? attackClip : activeClip;
      if (item.clip !== desiredClip) {
        item.mixer.stopAllAction();
        if (desiredClip) item.mixer.clipAction(desiredClip).reset().play();
        item.clip = desiredClip;
      }
      const leakProgress = leak
        ? Math.max(0, Math.min(1, (world.time - leak.startedAt) / (leak.impactAt - leak.startedAt)))
        : 0;
      const slowed = world.time < e.slowUntil;
      item.mixer.timeScale = (leak && !attackClip ? 0.45 : slowed ? e.slowFactor : 1) * timeScale;
      if (!frozen) item.mixer.update(delta);

      const path = world.paths[e.pathIndex] ?? world.paths[0];
      const dir = smoothDirection(path, e.segment, e.segmentT);
      const targetX = e.pos.x;
      const targetZ = -e.pos.y;
      // Engaged dinos face the hero so the bite/roar reads as an
      // attack on them, not at thin air. Falls back to path yaw when
      // the hero is gone or hero pos coincides with the enemy.
      let pathYaw = dir.x * dir.x + dir.y * dir.y > 1e-6 ? Math.atan2(dir.x, -dir.y) : item.visYaw;
      if (engagingHero) {
        const hero = world.hero;
        if (hero) {
          const hdx = hero.pos.x - e.pos.x;
          const hdy = hero.pos.y - e.pos.y;
          if (hdx * hdx + hdy * hdy > 1e-6) pathYaw = Math.atan2(hdx, -hdy);
        }
      }
      const motionX = targetX - item.visX;
      const motionZ = targetZ - item.visZ;
      const motionLenSq = motionX * motionX + motionZ * motionZ;
      const pathWorldX = dir.x;
      const pathWorldZ = -dir.y;
      // Engaged with hero — swivel toward the hero while still marching
      // along the path. Sim doesn't redirect movement (no chase), only
      // the model's facing is overridden so the skirmish reads.
      let targetYaw: number;
      if (e.engagedWithHero) {
        const heroDX = world.hero.pos.x - targetX;
        const heroDZ = -world.hero.pos.y - targetZ;
        if (heroDX * heroDX + heroDZ * heroDZ > 1e-6) {
          targetYaw = Math.atan2(heroDX, heroDZ);
        } else {
          targetYaw = pathYaw;
        }
      } else if (motionLenSq > 1e-6 && motionX * pathWorldX + motionZ * pathWorldZ > 0) {
        targetYaw = Math.atan2(motionX, motionZ);
      } else {
        targetYaw = pathYaw;
      }
      if (!item.visInit) {
        item.visX = targetX;
        item.visZ = targetZ;
        item.visYaw = targetYaw;
        item.visInit = true;
      } else {
        const kp = dampFactor(delta, POS_HALFLIFE);
        item.visX += (targetX - item.visX) * kp;
        item.visZ += (targetZ - item.visZ) * kp;
        const ky = dampFactor(delta, YAW_HALFLIFE);
        item.visYaw += shortAngleDelta(item.visYaw, targetYaw) * ky;
      }

      const poseT = leak ? Math.max(0, Math.min(1, (leakProgress - 0.35) / 0.65)) : 0;
      const attackPose = Math.sin(poseT * Math.PI);
      const bobY = bob ? Math.sin(world.time * 3 + e.id) * 0.12 : 0;
      item.obj.position.set(
        item.visX - centerXZ.x,
        yOffset - scaledMinY + bobY - attackPose * 0.08,
        item.visZ - centerXZ.z,
      );
      if (item.proxy) {
        // Click target tracks the true sim position so taps line up with
        // the actual enemy state, not the smoothed render lag.
        item.proxy.visible = !leak;
        if (!leak) {
          item.proxy.position.set(
            e.pos.x,
            yOffset - scaledMinY + bobY + proxyRadius * 0.55,
            -e.pos.y,
          );
        }
      }
      item.obj.rotation.set(attackPose * 0.18, baseRotY + item.visYaw, attackPose * 0.035);

      const flashing = world.time < e.flashUntil;
      const frost = e.frost;
      const elite = e.elite;
      // Matriarchs always wear their variant tint — they're a distinct
      // queen, not a chip-stacked rank-and-file. Captured here once per
      // enemy so the inner traverse callback is a cheap branch.
      const matriarch = bossVariant !== undefined;
      item.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (mm: THREE.MeshStandardMaterial) => {
          // Restore base color each frame, then layer on tints in order
          // of priority: frost wins outright (the "frozen solid" read
          // shouldn't fight with elite), otherwise elite shifts the
          // material toward the kind-specific tint. Skipping when both
          // are 0 keeps the no-op fast path allocation-free.
          const base = mm.userData.baseColor as THREE.Color | undefined;
          if (base && mm.color) {
            if (frost > 0.01) mm.color.copy(base).lerp(FROST_COLOR, frost);
            else if (matriarch && matriarchMaterial)
              mm.color.copy(base).lerp(eliteTint, matriarchMaterial.tintAmount);
            else if (elite) mm.color.copy(base).lerp(eliteTint, ELITE_TINT_AMOUNT);
            else mm.color.copy(base);
          }
          if (matriarch && matriarchMaterial) {
            mm.metalness = matriarchMaterial.metalness;
            mm.roughness = matriarchMaterial.roughness;
          }
          if (!mm.emissive) return;
          if (flashing) {
            // Warm-tinted, dimmed flash instead of pure white at full
            // intensity — reads as "got hit" without the harsh clinical
            // pop the (1,1,1) version had against varied dino base colors.
            mm.emissive.setRGB(0.7, 0.6, 0.5);
          } else if (frost > 0.05) {
            // Cool inner glow when heavily frosted — sells the "frozen
            // solid" read at high frost without a halo at low frost.
            mm.emissive.copy(FROST_EMISSIVE).multiplyScalar(frost * 0.5);
          } else if (matriarch && matriarchMaterial) {
            // Variant-specific charge: early species queens stay material
            // first, later queens carry more supernatural light.
            mm.emissive.copy(eliteTint).multiplyScalar(matriarchMaterial.emissiveAmount);
          } else if (elite) {
            // Inner rim glow in the kind's elite color — sells the
            // tint as a metallic / energized look rather than a dye job.
            mm.emissive.copy(eliteTint).multiplyScalar(ELITE_EMISSIVE_AMOUNT);
          } else {
            mm.emissive.setRGB(0, 0, 0);
          }
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      });
    }

    const recycleOrDispose = (item: Item) => {
      item.mixer.stopAllAction();
      // Reset rotation before pooling so the next recycle starts upright
      // even if the corpse was mid-tilt when the timer expired.
      item.obj.rotation.x = 0;
      item.obj.rotation.z = 0;
      if (poolRef.current.length < POOL_LIMIT) {
        // Stash for reuse: hide in place, keep parent attachment, drop
        // the userData id so a stale click can't dispatch.
        item.obj.visible = false;
        item.obj.userData.enemyId = undefined;
        if (item.proxy) {
          item.proxy.visible = false;
          item.proxy.userData.enemyId = undefined;
        }
        poolRef.current.push(item);
      } else {
        // Pool full — drop. Dispose per-clone materials we created in
        // the constructor branch so GPU resources don't leak.
        item.obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.material) return;
          if (Array.isArray(m.material)) for (const mm of m.material) mm.dispose();
          else (m.material as THREE.Material).dispose();
        });
        parent.remove(item.obj);
        if (item.proxy) parent.remove(item.proxy);
      }
    };

    for (const [id, item] of itemsRef.current) {
      if (live.has(id)) continue;

      if (item.dying) {
        // Death anim in flight: keep ticking the mixer (or tilt-fall the
        // pose if no Death clip is driving it) until the duration runs
        // out, then pool. world.time freezes when status !== "running",
        // so a pause mid-fall holds the pose until the player resumes.
        if (!frozen) item.mixer.update(delta);
        const elapsed = world.time - item.dyingStart;
        const t = Math.max(0, Math.min(1, elapsed / item.dyingDuration));
        const eased = 1 - (1 - t) ** 2;
        if (item.clip === null) {
          item.obj.rotation.x = item.dyingBaseRotX - eased * (Math.PI / 2);
        }
        // Ramp ground lift so the corpse rises just enough to cancel
        // the rest-pose bbox dip as the skeleton flattens. Eased so the
        // first frame doesn't pop and the held-final-pose stays lifted.
        item.obj.position.y = item.dyingBaseY + deathGroundLift * eased;
        if (t >= 1) {
          recycleOrDispose(item);
          itemsRef.current.delete(id);
        }
        continue;
      }

      // Fresh transition from live → gone. Skip the death anim for
      // leakers (they reached HQ — the attack pose already covered it)
      // and for non-running states (wave reset shouldn't pile corpses).
      const playDeath = !item.wasLeak && world.status === "running";
      if (!playDeath) {
        recycleOrDispose(item);
        itemsRef.current.delete(id);
        continue;
      }

      item.dying = true;
      item.dyingStart = world.time;
      item.dyingBaseRotX = item.obj.rotation.x;
      item.dyingBaseY = item.obj.position.y;
      // Strip click affordance immediately — corpse mid-fall is not a
      // valid inspect target.
      item.obj.userData.enemyId = undefined;
      item.obj.traverse((o) => {
        o.userData.enemyId = undefined;
      });
      if (item.proxy) {
        item.proxy.visible = false;
        item.proxy.userData.enemyId = undefined;
      }
      if (deathClip) {
        item.mixer.stopAllAction();
        const action = item.mixer.clipAction(deathClip);
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.timeScale = 1;
        action.play();
        item.clip = deathClip;
        item.mixer.timeScale = 1;
        item.dyingDuration = Math.max(0.1, deathClip.duration);
      } else {
        // No Death clip in this GLB — freeze the run/walk loop so the
        // pose holds, and let the dying tick handle the forward topple.
        item.mixer.stopAllAction();
        item.clip = null;
        item.dyingDuration = DEATH_FALLBACK_SEC;
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const state = useGame.getState();
    // Placing a tower? Let the placement plane handle the click.
    if (state.selectedKind !== null) return;
    // Mortar aiming in spot mode outranks inspecting a passing dino —
    // otherwise a wandering enemy would swallow the spot-set click.
    const selId = state.world.selectedTowerId;
    if (selId !== null) {
      const sel = state.world.towerById.get(selId);
      if (sel && sel.kind === "mortar" && sel.targetingMode === "spot") return;
    }
    // Hero control outranks dino inspection. When the hero is selected,
    // left-click on a dino must NOT pop the enemy panel and must NOT
    // de-select the hero — instead, let the click bubble through to the
    // placement plane so it becomes an orderHeroMove (treats the dino's
    // ground spot as a waypoint). Right-click on a dino is the dedicated
    // inspect channel below.
    if (state.world.hero.selected) return;
    let obj: THREE.Object3D | null = e.object;
    while (obj && obj.userData.enemyId === undefined) obj = obj.parent;
    if (!obj) return;
    e.stopPropagation();
    state.inspectEnemy(
      obj.userData.enemyId as number,
      kind,
      obj.userData.enemyMaxHp as number,
      bossVariant ?? null,
    );
  };

  // Right-click on a dino always opens its info panel, regardless of
  // hero selection. Stop propagation so the placement plane's
  // contextmenu (which would normally issue an orderHeroMove) doesn't
  // also fire — the player asked for info, not a move order.
  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    const state = useGame.getState();
    if (state.selectedKind !== null) return;
    let obj: THREE.Object3D | null = e.object;
    while (obj && obj.userData.enemyId === undefined) obj = obj.parent;
    if (!obj) return;
    e.nativeEvent.preventDefault();
    e.stopPropagation();
    state.inspectEnemy(
      obj.userData.enemyId as number,
      kind,
      obj.userData.enemyMaxHp as number,
      bossVariant ?? null,
    );
  };

  return <group ref={groupRef} onClick={handleClick} onContextMenu={handleContextMenu} />;
};

useGLTF.preload("/models/Velociraptor.glb");
useGLTF.preload("/models/Trex.glb");
useGLTF.preload("/models/Stegosaurus.glb");
useGLTF.preload("/models/Triceratops.glb");
useGLTF.preload("/models/Parasaurolophus.glb");
useGLTF.preload("/models/Apatosaurus.glb");
