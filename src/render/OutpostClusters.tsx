import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { collectMeshSource } from "./meshSource";
import { ALL_OUTPOST_URLS, KIT_SCALE, outpostUrl, type PlacedOutpost } from "./outpostKit";

// Every baked KayKit GLB embeds the same 1024² atlas. We reuse the first
// texture we see across every piece so the whole kit is one GPU upload
// instead of ~30 identical copies.
let sharedMap: THREE.Texture | null = null;

// Renders a list of placed outpost clusters. Each cluster expands into its
// template's pieces; pieces are flattened across every cluster and grouped
// by model URL so the whole outpost layer collapses to one InstancedMesh
// per (model, sub-part) regardless of how many colonies are on screen.
//
// World mapping matches the rest of the renderer: sim (x, y) -> three
// (x, _, -y). A piece sits on the ground (its own lowest vertex at y=0)
// plus an optional `lift` (world units) for stacking — a roofmodule on a
// dome, a lander on a pad.

const noRaycast: THREE.Mesh["raycast"] = () => {};

type PieceInstance = {
  x: number;
  z: number;
  y: number; // lift in world units, added on top of per-part grounding
  yaw: number;
  scale: number;
};

const ModelInstances = ({
  url,
  items,
  castShadow,
  raycast,
}: {
  url: string;
  items: PieceInstance[];
  castShadow: boolean;
  raycast: THREE.Mesh["raycast"];
}) => {
  const { scene } = useGLTF(url);
  const source = useMemo(() => {
    const s = collectMeshSource(scene);
    if (s) {
      for (const part of s.parts) {
        const mat = part.material as THREE.MeshStandardMaterial;
        if (!mat.map) continue;
        // Collapse every identical embedded atlas onto one shared texture.
        if (sharedMap) mat.map = sharedMap;
        else sharedMap = mat.map;
        mat.needsUpdate = true;
      }
    }
    return s;
  }, [scene]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    if (!source) return;
    const dummy = new THREE.Object3D();
    for (const im of refs.current) {
      if (!im) continue;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        dummy.position.set(it.x, -source.minY * it.scale + it.y, it.z);
        dummy.rotation.set(0, it.yaw, 0);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = items.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [items, source]);

  if (!source || items.length === 0) return null;

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          // biome-ignore lint/suspicious/noArrayIndexKey: parts array is stable per scene
          key={pi}
          ref={(el: THREE.InstancedMesh | null) => {
            refs.current[pi] = el;
          }}
          args={[part.geom, part.material, items.length]}
          castShadow={castShadow}
          receiveShadow
          raycast={raycast}
        />
      ))}
    </group>
  );
};

export const OutpostClusters = ({
  clusters,
  castShadow = true,
  interactive = false,
}: {
  clusters: PlacedOutpost[];
  castShadow?: boolean;
  interactive?: boolean;
}) => {
  const groups = useMemo(() => {
    const byUrl = new Map<string, PieceInstance[]>();
    for (const cluster of clusters) {
      const s = KIT_SCALE * cluster.scale;
      const cos = Math.cos(cluster.yaw);
      const sin = Math.sin(cluster.yaw);
      for (const part of cluster.template.parts) {
        const wx = cluster.pos.x + (part.dx * cos - part.dz * sin) * s;
        const wy = cluster.pos.y + (part.dx * sin + part.dz * cos) * s;
        const url = outpostUrl(part.model);
        const list = byUrl.get(url) ?? [];
        list.push({
          x: wx,
          z: -wy,
          y: (part.lift ?? 0) * s,
          yaw: cluster.yaw + (part.yaw ?? 0),
          scale: s * (part.scale ?? 1),
        });
        byUrl.set(url, list);
      }
    }
    return [...byUrl.entries()];
  }, [clusters]);

  const raycast = interactive ? undefined : noRaycast;

  return (
    <>
      {groups.map(([url, items]) => (
        <ModelInstances
          key={url}
          url={url}
          items={items}
          castShadow={castShadow}
          raycast={raycast as THREE.Mesh["raycast"]}
        />
      ))}
    </>
  );
};

for (const url of ALL_OUTPOST_URLS) useGLTF.preload(url);
