import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { findClip } from "./animUtils";
import { measureVisibleBox } from "./measureModel";

// Shared dead-dinosaur carcass renderer. Used both on the world map (under
// cleared levels) and inside levels (a few corpses near each HQ to read as
// aftermath of prior waves). Each instance gets its own skinned clone via
// SkeletonUtils.clone so per-instance pose state doesn't leak; an
// AnimationMixer is stepped once to the final Death-clip frame and the
// resulting bone pose is baked into the renderer with no per-frame work.

export type DeadDinoSpec = { url: string; footprint: number };

export const DEAD_DINO_SPECS: DeadDinoSpec[] = [
  { url: "/models/Velociraptor.glb", footprint: 3.6 },
  { url: "/models/Parasaurolophus.glb", footprint: 4.0 },
  { url: "/models/Stegosaurus.glb", footprint: 4.2 },
  { url: "/models/Triceratops.glb", footprint: 4.2 },
  { url: "/models/Trex.glb", footprint: 4.6 },
];

export const DEAD_DINO_URLS = DEAD_DINO_SPECS.map((s) => s.url);
export const DEAD_DINO_FOOTPRINT: Record<string, number> = Object.fromEntries(
  DEAD_DINO_SPECS.map((s) => [s.url, s.footprint]),
);
export const isDeadDinoUrl = (url: string) => DEAD_DINO_FOOTPRINT[url] !== undefined;

export type DeadDinoItem = {
  id: string;
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
};

const noRaycast: THREE.Mesh["raycast"] = () => {};

export const DeadDinoInstancer = ({ url, items }: { url: string; items: DeadDinoItem[] }) => {
  const gltf = useGLTF(url);
  const footprint = DEAD_DINO_FOOTPRINT[url] ?? 2.0;

  // One skinned clone per instance, posed once at Death-clip end and then
  // left static. Memoized on the source scene + url so HMR rebuilds the
  // clones if the asset reloads but instances aren't re-cloned on every
  // render.
  const clones = useMemo(() => {
    return items.map((it) => {
      const obj = cloneSkinned(gltf.scene);
      // Bake the Death-clip end pose. All shipped dino GLBs include
      // a "Death" clip; fall back to substrings (`Die`, `Dead`) for
      // future packs.
      const deathClip =
        findClip(gltf.animations, "Death") ??
        findClip(gltf.animations, "Die") ??
        findClip(gltf.animations, "Dead") ??
        null;
      if (deathClip) {
        const mixer = new THREE.AnimationMixer(obj);
        const action = mixer.clipAction(deathClip);
        action.play();
        action.setLoop(THREE.LoopOnce, 0);
        action.clampWhenFinished = true;
        mixer.setTime(deathClip.duration);
        obj.updateMatrixWorld(true);
      }
      // Normalize the post-death silhouette to the bucket footprint and
      // ground-rest it. measureVisibleBox walks the posed skin (not the
      // bind-pose attribute) so the corpse's actual footprint drives the
      // scale instead of the standing rig.
      const box = measureVisibleBox(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const s = (footprint / maxDim) * it.scale;
      obj.scale.setScalar(s);
      const scaledBox = measureVisibleBox(obj);
      const liftY = Number.isFinite(scaledBox.min.y) ? -scaledBox.min.y : 0;
      obj.position.set(it.pos.x, liftY, it.pos.z);
      obj.rotation.set(0, it.rotY, 0);
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        m.raycast = noRaycast;
      });
      return { id: it.id, obj };
    });
  }, [gltf.scene, gltf.animations, items, footprint]);

  return (
    <group>
      {clones.map((c) => (
        <primitive key={c.id} object={c.obj} />
      ))}
    </group>
  );
};

for (const url of DEAD_DINO_URLS) useGLTF.preload(url);
