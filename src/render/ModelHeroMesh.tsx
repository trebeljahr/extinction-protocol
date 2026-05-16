import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useGame } from "../store";
import { measureVisibleBox } from "./measureModel";

const HERO_URL: Record<string, string> = {
  george: "/models/heroes/George.glb",
  leela: "/models/heroes/Leela.glb",
  mike: "/models/heroes/Mike.glb",
  stan: "/models/heroes/Stan.glb",
};

const TARGET_SIZE = 1.8;
const POS_HALFLIFE = 0.04;
const YAW_HALFLIFE = 0.08;
// Reference hover lift used to normalize jet opacity. Stays in sync
// with HERO_HOVER_HEIGHT in sim/hero.ts; render reads hero.hoverHeight
// directly and divides by this to get a 0..1 intensity.
const HOVER_HEIGHT_FULL = 0.55;
const JET_COLOR = new THREE.Color("#9fd8ff");

const dampFactor = (dt: number, halflife: number) => 1 - 0.5 ** (dt / halflife);

const shortAngleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const FLASH_COLOR = new THREE.Color("#ff8a4a");

const findClip = (clips: THREE.AnimationClip[], names: string[]): THREE.AnimationClip | null => {
  for (const n of names) {
    const hit = clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (hit) return hit;
  }
  for (const n of names) {
    const hit = clips.find((c) => c.name.toLowerCase().includes(n.toLowerCase()));
    if (hit) return hit;
  }
  return null;
};

const cloneAndCaptureBase = (mat: THREE.Material): THREE.Material => {
  const c = mat.clone();
  const std = c as THREE.MeshStandardMaterial;
  if (std.emissive) std.userData.baseEmissive = std.emissive.clone();
  return c;
};

export const ModelHeroMesh = () => {
  const variant = useGame((s) => s.world.hero.variant);
  const url = HERO_URL[variant] ?? HERO_URL.george;
  const { scene, animations } = useGLTF(url);

  const groupRef = useRef<THREE.Group>(null);
  const objRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentClipRef = useRef<string | null>(null);
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const visRef = useRef<{ x: number; z: number; yaw: number; init: boolean }>({
    x: 0,
    z: 0,
    yaw: 0,
    init: false,
  });
  const jetRef = useRef<THREE.Mesh>(null);

  const { normalizedScale, centerXZ, scaledMinY } = useMemo(() => {
    const box = measureVisibleBox(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = TARGET_SIZE / maxDim;
    return {
      normalizedScale: s,
      centerXZ: { x: center.x * s, z: center.z * s },
      scaledMinY: box.min.y * s,
    };
  }, [scene]);

  const clips = useMemo(() => {
    return {
      idle: findClip(animations, ["Idle"]),
      walk: findClip(animations, ["Walk"]),
      run: findClip(animations, ["Run"]),
      shoot: findClip(animations, ["Shoot"]),
      death: findClip(animations, ["Death"]),
      dash: findClip(animations, ["Run", "Walk_Tall"]),
    };
  }, [animations]);

  useEffect(() => {
    const parent = groupRef.current;
    if (!parent) return;
    const obj = cloneSkinned(scene);
    obj.scale.setScalar(normalizedScale);
    const mats: THREE.MeshStandardMaterial[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mm) => {
            const c = cloneAndCaptureBase(mm);
            if ((c as THREE.MeshStandardMaterial).emissive) {
              mats.push(c as THREE.MeshStandardMaterial);
            }
            return c;
          });
        } else if (m.material) {
          const c = cloneAndCaptureBase(m.material as THREE.Material);
          m.material = c;
          if ((c as THREE.MeshStandardMaterial).emissive) {
            mats.push(c as THREE.MeshStandardMaterial);
          }
        }
      }
    });
    const mixer = new THREE.AnimationMixer(obj);
    parent.add(obj);
    objRef.current = obj;
    mixerRef.current = mixer;
    matsRef.current = mats;
    return () => {
      mixer.stopAllAction();
      parent.remove(obj);
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.material) return;
        if (Array.isArray(m.material)) for (const mm of m.material) mm.dispose();
        else (m.material as THREE.Material).dispose();
      });
      objRef.current = null;
      mixerRef.current = null;
      matsRef.current = [];
      currentClipRef.current = null;
    };
  }, [scene, normalizedScale]);

  useFrame((_, delta) => {
    const obj = objRef.current;
    const mixer = mixerRef.current;
    if (!obj || !mixer) return;
    const { world } = useGame.getState();
    const hero = world.hero;
    const frozen = world.status !== "running";

    // Pick clip by state. Shoot stamps a quick flash; dash + walk are
    // looping; death pinned to last frame.
    let pick: THREE.AnimationClip | null = null;
    let key = "idle";
    if (hero.motionState === "dead") {
      pick = clips.death ?? clips.idle;
      key = "death";
    } else if (hero.motionState === "dash") {
      pick = clips.run ?? clips.walk ?? clips.idle;
      key = "run";
    } else if (hero.motionState === "walk") {
      pick = clips.walk ?? clips.run ?? clips.idle;
      key = "walk";
    } else if (hero.motionState === "shoot") {
      pick = clips.shoot ?? clips.idle;
      key = "shoot";
    } else {
      pick = clips.idle ?? clips.walk;
      key = "idle";
    }
    if (currentClipRef.current !== key) {
      mixer.stopAllAction();
      if (pick) {
        const action = mixer.clipAction(pick);
        action.reset();
        if (key === "death") {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        action.play();
      }
      currentClipRef.current = key;
    }
    mixer.timeScale = hero.motionState === "dash" ? 1.45 : 1;
    if (!frozen) mixer.update(delta);

    // Smoothed visual transform. Source-of-truth pos stays on hero.pos.
    const vis = visRef.current;
    const targetX = hero.pos.x;
    const targetZ = -hero.pos.y;
    if (!vis.init) {
      vis.x = targetX;
      vis.z = targetZ;
      vis.yaw = hero.facing;
      vis.init = true;
    } else {
      const kp = dampFactor(delta, POS_HALFLIFE);
      vis.x += (targetX - vis.x) * kp;
      vis.z += (targetZ - vis.z) * kp;
      const ky = dampFactor(delta, YAW_HALFLIFE);
      vis.yaw += shortAngleDelta(vis.yaw, hero.facing) * ky;
    }

    obj.position.set(vis.x - centerXZ.x, -scaledMinY + hero.hoverHeight, vis.z - centerXZ.z);
    obj.rotation.set(0, vis.yaw, 0);
    obj.visible = hero.alive || hero.motionState === "dead";

    // Jetpack jet visual — two downward thrust cones beneath the
    // hero whose opacity tracks the hover engagement so they fade in
    // as the hero lifts off and out as she touches dry ground.
    const jet = jetRef.current;
    if (jet) {
      const lift = hero.hoverHeight;
      const intensity = Math.max(0, Math.min(1, lift / HOVER_HEIGHT_FULL));
      jet.visible = intensity > 0.02;
      if (jet.visible) {
        jet.position.set(vis.x, lift * 0.55, vis.z);
        const flicker = 0.85 + Math.sin(world.time * 38) * 0.15;
        jet.scale.set(0.55, 0.55 * flicker, 0.55);
        const mat = jet.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity * 0.85;
      }
    }

    // Flash tint: hurt + muzzle flare share a warm emissive pop.
    const flashing = world.time < hero.flashUntil || world.time < hero.shootFlashUntil;
    for (const m of matsRef.current) {
      const base = m.userData.baseEmissive as THREE.Color | undefined;
      if (!base) continue;
      if (flashing) m.emissive.copy(FLASH_COLOR).multiplyScalar(0.5);
      else m.emissive.copy(base);
    }
  });

  // Click target — invisible sphere above the hero so a single click
  // is enough to "select" her (then the next ground click moves).
  const proxyRadius = TARGET_SIZE * 0.6;
  const proxyGeom = useMemo(() => new THREE.SphereGeometry(proxyRadius, 8, 6), [proxyRadius]);
  const proxyMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  // Jetpack thrust cone — open end down, tapers toward the hero's feet.
  // ConeGeometry's default orientation points +Y, so rotate it so the
  // wide end faces the ground (-Y) for a plausible exhaust shape.
  const jetGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(0.55, 1.1, 14, 1, true);
    g.rotateX(Math.PI);
    return g;
  }, []);
  const jetMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: JET_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(
    () => () => {
      proxyGeom.dispose();
      proxyMat.dispose();
      jetGeom.dispose();
      jetMat.dispose();
    },
    [proxyGeom, proxyMat, jetGeom, jetMat],
  );
  const proxyRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = proxyRef.current;
    if (!mesh) return;
    const hero = useGame.getState().world.hero;
    mesh.visible = hero.alive;
    mesh.position.set(hero.pos.x, proxyRadius * 0.9, -hero.pos.y);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const state = useGame.getState();
    // Tower placement / mortar spot mode wins over hero selection.
    if (state.selectedKind !== null) return;
    const selId = state.world.selectedTowerId;
    if (selId !== null) {
      const sel = state.world.towerById.get(selId);
      if (sel && sel.kind === "mortar" && sel.targetingMode === "spot") return;
    }
    e.stopPropagation();
    state.selectHeroUnit(!state.world.hero.selected);
  };

  return (
    <group ref={groupRef}>
      <mesh ref={proxyRef} geometry={proxyGeom} material={proxyMat} onClick={onClick} />
      <mesh ref={jetRef} geometry={jetGeom} material={jetMat} visible={false} />
    </group>
  );
};

useGLTF.preload("/models/heroes/George.glb");
useGLTF.preload("/models/heroes/Leela.glb");
useGLTF.preload("/models/heroes/Mike.glb");
useGLTF.preload("/models/heroes/Stan.glb");
