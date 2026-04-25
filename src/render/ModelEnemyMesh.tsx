import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { EnemyKind } from "../sim/types";
import { useGame } from "../store";

type Props = {
  kind: EnemyKind;
  url: string;
  targetSize: number;
  yOffset?: number;
  baseRotY?: number;
  bob?: boolean;
  clip?: string;
};

type Item = {
  obj: THREE.Object3D;
  proxy: THREE.Mesh | null;
  mixer: THREE.AnimationMixer;
  // Smoothed visual state — lags `e.pos` / path yaw slightly so corner
  // turns arc instead of teleport+snap. Sim-side `e.pos` stays the
  // source of truth for towers and click hits.
  visX: number;
  visZ: number;
  visYaw: number;
  visInit: boolean;
};

// Exp-damp half-life (seconds). Lower = snappier, higher = floatier.
// 0.08s on yaw matches roughly a quarter-second to settle through a
// 90° corner at typical speeds — readable as a turn, not a flick.
const POS_HALFLIFE = 0.06;
const YAW_HALFLIFE = 0.09;

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
}: Props) => {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const itemsRef = useRef<Map<number, Item>>(new Map());
  // Free list of skinned clones from dead-but-recyclable enemies. Reusing
  // is significantly cheaper than another `cloneSkinned + AnimationMixer`,
  // which matters for swarms.
  const poolRef = useRef<Item[]>([]);

  const { normalizedScale, centerXZ, scaledMinY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
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

  // Invisible, oversized tap target. Lets users hit the enemy even when
  // their finger lands next to the silhouette — critical on touch. The
  // titan's native silhouette is already huge, so it opts out.
  const useProxy = kind !== "titan";
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

    const live = new Set<number>();
    for (const e of world.enemies) {
      if (e.kind !== kind) continue;
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
          if (activeClip) recycled.mixer.clipAction(activeClip).reset().play();
          if (recycled.proxy) {
            recycled.proxy.visible = true;
            recycled.proxy.userData.enemyId = e.id;
            recycled.proxy.userData.enemyMaxHp = e.maxHp;
          }
          recycled.visInit = false;
          item = recycled;
        } else {
          const obj = cloneSkinned(scene);
          obj.scale.setScalar(normalizedScale);
          obj.userData.enemyId = e.id;
          obj.userData.enemyMaxHp = e.maxHp;
          obj.traverse((o) => {
            o.userData.enemyId = e.id;
            o.userData.enemyMaxHp = e.maxHp;
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
              // SkeletonUtils.clone shares material references across
              // clones, so mutating .emissive for the hit-flash would
              // light up every enemy of this kind. Give each clone its
              // own material so flashes stay local.
              if (Array.isArray(m.material)) {
                m.material = m.material.map((mm) => mm.clone());
              } else if (m.material) {
                m.material = (m.material as THREE.Material).clone();
              }
            }
          });
          const mixer = new THREE.AnimationMixer(obj);
          if (activeClip) mixer.clipAction(activeClip).play();
          parent.add(obj);

          let proxy: THREE.Mesh | null = null;
          if (proxyGeom && proxyMat) {
            proxy = new THREE.Mesh(proxyGeom, proxyMat);
            proxy.userData.enemyId = e.id;
            proxy.userData.enemyMaxHp = e.maxHp;
            proxy.renderOrder = -1;
            parent.add(proxy);
          }

          item = { obj, proxy, mixer, visX: 0, visZ: 0, visYaw: 0, visInit: false };
        }
        itemsRef.current.set(e.id, item);
      }

      const slowed = world.time < e.slowUntil;
      item.mixer.timeScale = slowed ? e.slowFactor : 1;
      item.mixer.update(delta);

      const path = world.paths[e.pathIndex] ?? world.paths[0];
      const a = path[e.segment];
      const b = path[e.segment + 1] ?? a;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const targetYaw = dx * dx + dy * dy > 1e-6 ? Math.atan2(dx, -dy) : item.visYaw;

      const targetX = e.pos.x;
      const targetZ = -e.pos.y;
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

      const bobY = bob ? Math.sin(world.time * 3 + e.id) * 0.12 : 0;
      item.obj.position.set(
        item.visX - centerXZ.x,
        yOffset - scaledMinY + bobY,
        item.visZ - centerXZ.z,
      );
      if (item.proxy) {
        // Click target tracks the true sim position so taps line up with
        // the actual enemy state, not the smoothed render lag.
        item.proxy.position.set(
          e.pos.x,
          yOffset - scaledMinY + bobY + proxyRadius * 0.55,
          -e.pos.y,
        );
      }
      item.obj.rotation.set(0, baseRotY + item.visYaw, 0);

      const flashing = world.time < e.flashUntil;
      item.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (mm: THREE.MeshStandardMaterial) => {
          if (!mm.emissive) return;
          if (flashing) mm.emissive.setRGB(1, 1, 1);
          else mm.emissive.setRGB(0, 0, 0);
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      });
    }

    for (const [id, item] of itemsRef.current) {
      if (!live.has(id)) {
        item.mixer.stopAllAction();
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
        itemsRef.current.delete(id);
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
    let obj: THREE.Object3D | null = e.object;
    while (obj && obj.userData.enemyId === undefined) obj = obj.parent;
    if (!obj) return;
    e.stopPropagation();
    state.inspectEnemy(obj.userData.enemyId as number, kind, obj.userData.enemyMaxHp as number);
  };

  return <group ref={groupRef} onClick={handleClick} />;
};

useGLTF.preload("/models/Velociraptor.glb");
useGLTF.preload("/models/Trex.glb");
useGLTF.preload("/models/Stegosaurus.glb");
useGLTF.preload("/models/Triceratops.glb");
useGLTF.preload("/models/Parasaurolophus.glb");
useGLTF.preload("/models/Apatosaurus.glb");
