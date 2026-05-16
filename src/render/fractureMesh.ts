import * as THREE from "three";
import { Brush, Evaluator, INTERSECTION } from "three-bvh-csg";
import { mergeBufferGeometries, mergeVertices } from "three-stdlib";

// Pre-fracture a baked mesh geometry into N voronoi-cell chunks. The
// source must be a closed (or near-closed) manifold; the GLB turret meets
// this well enough for CSG. Output chunks are recentred so each piece's
// origin is its own centroid — drop the centroid into a RigidBody.position
// and the chunk geometry hangs around the body's origin naturally.
//
// Cost: 14 seeds × 13 bisector intersections + 14 final source intersects
// = ~200 CSG ops. three-bvh-csg uses BVH acceleration so each op is fast
// against simple halfspace boxes; total budget is a few hundred ms one-time
// at module load. Acceptable since fracture happens before the first death
// and never on a frame that the player can see frozen.

export type FractureChunk = {
  geometry: THREE.BufferGeometry;
  // Centroid in the source mesh's local frame. The chunk geometry has
  // been translated so this point is at the chunk's local origin.
  origin: THREE.Vector3;
  // Bounding-radius estimate, used for collider sizing fallback.
  radius: number;
};

const halfspaceBrush = (plane: THREE.Plane, big: number): Brush => {
  const box = new THREE.BoxGeometry(big, big, big);
  box.translate(0, 0, big / 2);
  const z = plane.normal.clone().normalize();
  const up = Math.abs(z.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, z);
  box.applyMatrix4(basis);
  const p = z.clone().multiplyScalar(-plane.constant);
  box.translate(p.x, p.y, p.z);
  const welded = mergeVertices(box, 1e-5);
  return new Brush(welded);
};

const ensureIndexedPositionOnly = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const stripped = new THREE.BufferGeometry();
  const pos = g.getAttribute("position");
  stripped.setAttribute("position", pos);
  const norm = g.getAttribute("normal");
  if (norm) stripped.setAttribute("normal", norm);
  if (g.index) {
    stripped.setIndex(g.index);
  } else {
    const idx = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i++) idx[i] = i;
    stripped.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return stripped;
};

// Bake an Object3D hierarchy into a single welded BufferGeometry in the
// root's local frame. All child meshes contribute; their material data is
// dropped (CSG operates on position only).
export const bakeObjectToGeometry = (root: THREE.Object3D): THREE.BufferGeometry => {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geoms: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = ensureIndexedPositionOnly(m.geometry).clone();
    const localMat = new THREE.Matrix4().multiplyMatrices(rootInverse, m.matrixWorld);
    g.applyMatrix4(localMat);
    geoms.push(g);
  });
  if (geoms.length === 0) return new THREE.BufferGeometry();
  const merged = mergeBufferGeometries(geoms, false) ?? geoms[0];
  const welded = mergeVertices(merged, 1e-4);
  welded.computeVertexNormals();
  return welded;
};

// Mulberry32 — small deterministic RNG so seeds are stable across remounts.
const mkRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const fractureGeometry = (
  source: THREE.BufferGeometry,
  numSeeds = 14,
  seed = 1,
): FractureChunk[] => {
  if (!source.getAttribute("position") || source.getAttribute("position").count === 0) return [];

  const rng = mkRng(seed);
  const indexed = ensureIndexedPositionOnly(source);
  const bbox = new THREE.Box3().setFromBufferAttribute(
    indexed.getAttribute("position") as THREE.BufferAttribute,
  );
  const size = bbox.getSize(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z, 0.01) * 12;

  const seeds: THREE.Vector3[] = [];
  for (let i = 0; i < numSeeds; i++) {
    // Triangular bias toward bbox interior so chunks aren't dominated by
    // tiny sliver cells at corners.
    const fx = (rng() + rng()) * 0.5;
    const fy = (rng() + rng()) * 0.5;
    const fz = (rng() + rng()) * 0.5;
    seeds.push(
      new THREE.Vector3(
        bbox.min.x + fx * size.x,
        bbox.min.y + fy * size.y,
        bbox.min.z + fz * size.z,
      ),
    );
  }

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  evaluator.attributes = ["position", "normal"];

  const sourceBrush = new Brush(indexed);
  sourceBrush.updateMatrixWorld();

  const chunks: FractureChunk[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let cell: Brush = sourceBrush;
    let aborted = false;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const s2 = seeds[j];
      const normal = s.clone().sub(s2);
      const nlen = normal.length();
      if (nlen < 1e-6) continue;
      normal.multiplyScalar(1 / nlen);
      const point = s.clone().add(s2).multiplyScalar(0.5);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
      const hs = halfspaceBrush(plane, big);
      const out = new Brush(new THREE.BufferGeometry());
      try {
        evaluator.evaluate(cell, hs, INTERSECTION, out);
      } catch (_e) {
        aborted = true;
        break;
      }
      const pos = out.geometry.getAttribute("position");
      if (!pos || pos.count === 0) {
        aborted = true;
        break;
      }
      cell = out;
    }
    if (aborted) continue;

    const g = cell.geometry;
    const pos = g.getAttribute("position");
    if (!pos || pos.count === 0) continue;

    const cbox = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
    const cCenter = cbox.getCenter(new THREE.Vector3());
    const cSize = cbox.getSize(new THREE.Vector3());
    g.translate(-cCenter.x, -cCenter.y, -cCenter.z);
    g.computeVertexNormals();

    chunks.push({
      geometry: g,
      origin: cCenter,
      radius: Math.max(cSize.x, cSize.y, cSize.z) * 0.5 || 0.05,
    });
  }
  return chunks;
};
