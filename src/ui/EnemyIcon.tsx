import { useEffect, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";

// Per-kind camera/pose tuning. Each model is normalized to fit a 1×1×1
// box, then framed from the side.
const ICON_TUNING: Record<
  EnemyKind,
  { rotY: number; camDist: number; camY: number; targetY: number }
> = {
  raptor: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  swarm: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  para: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  allosaur: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  stego: { rotY: 0, camDist: 1.5, camY: 0.45, targetY: 0.4 },
  armored: { rotY: 0, camDist: 1.5, camY: 0.45, targetY: 0.4 },
  titan: { rotY: 0, camDist: 1.5, camY: 0.55, targetY: 0.5 },
  boss: { rotY: 0, camDist: 1.5, camY: 0.55, targetY: 0.5 },
};

const ICON_RES = 256;

// Each enemy icon is baked exactly once into a PNG data URL through a
// single shared offscreen WebGLRenderer, then served to every consumer
// as a plain <img>. Without this the Compendium tab strip would need
// 8 simultaneous WebGL contexts and we'd blow past the browser cap
// (already pressured by EnemyPreview + the world-map canvas).
const cache = new Map<EnemyKind, string>();
const subscribers = new Set<() => void>();
const notify = () => {
  for (const cb of subscribers) cb();
};

const sceneCache = new Map<string, THREE.Object3D>();
let loader: GLTFLoader | null = null;
const getLoader = (): GLTFLoader => {
  if (loader) return loader;
  loader = new GLTFLoader();
  // The shipped enemy GLBs use Draco mesh compression; without a
  // DRACOLoader the parse fails. Drei's useGLTF wires this up by
  // default — we mirror it with the same upstream decoder path.
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
  loader.setDRACOLoader(draco);
  return loader;
};
const loadGLTF = async (url: string): Promise<THREE.Object3D> => {
  const cached = sceneCache.get(url);
  if (cached) return cached;
  const gltf = await getLoader().loadAsync(url);
  sceneCache.set(url, gltf.scene);
  return gltf.scene;
};

let sharedRenderer: THREE.WebGLRenderer | null = null;
const getRenderer = (): THREE.WebGLRenderer => {
  if (sharedRenderer) return sharedRenderer;
  const canvas = document.createElement("canvas");
  canvas.width = ICON_RES;
  canvas.height = ICON_RES;
  sharedRenderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  sharedRenderer.setPixelRatio(1);
  sharedRenderer.setSize(ICON_RES, ICON_RES, false);
  sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
  return sharedRenderer;
};

const renderToDataURL = async (kind: EnemyKind): Promise<string> => {
  const cfg = ENEMY_MODEL[kind];
  const tuning = ICON_TUNING[kind];
  const sceneSrc = await loadGLTF(cfg.url);

  const cloned = cloneSkinned(sceneSrc);
  cloned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cloned);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const s = 1 / maxDim;
  cloned.scale.setScalar(s);
  cloned.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  // Drop shadows for the static bake; they need a depth pre-pass that
  // doesn't pay off at icon resolution.
  cloned.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.rotation.y = tuning.rotY;
  root.add(cloned);
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xeaf2ff, 0.9));
  const key = new THREE.DirectionalLight(0xfff4dc, 2.2);
  key.position.set(6, 8, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.85);
  fill.position.set(-4, 4, -2);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x5a4a2a, 0.95));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(tuning.camDist, tuning.camY, 0.0001);
  camera.lookAt(0, tuning.targetY, 0);

  const renderer = getRenderer();
  // Two passes: PBR materials sometimes defer shader compile to the
  // first draw, so the first frame can come back with a flat fallback.
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  // Drop the throw-away clone's GPU resources. The original gltf scene
  // stays in sceneCache so future re-bakes (e.g. dev HMR) skip the
  // network fetch.
  cloned.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
  });
  return url;
};

// Bakes run sequentially on the single shared renderer so that
// concurrent requests from the 8 Compendium tabs don't trample each
// other's scene/camera/lighting setup mid-render.
let bakeQueue: Promise<unknown> = Promise.resolve();
const inflight = new Set<EnemyKind>();
const requestBake = (kind: EnemyKind) => {
  if (cache.has(kind) || inflight.has(kind)) return;
  inflight.add(kind);
  const p = bakeQueue
    .catch(() => {})
    .then(() => renderToDataURL(kind))
    .then((url) => {
      cache.set(kind, url);
      inflight.delete(kind);
      notify();
    })
    .catch((err) => {
      console.error(`[EnemyIcon] Failed to bake ${kind}`, err);
      inflight.delete(kind);
    });
  bakeQueue = p;
};

const useEnemyIconUrl = (kind: EnemyKind): string | null => {
  const [url, setUrl] = useState<string | null>(() => cache.get(kind) ?? null);
  useEffect(() => {
    const cached = cache.get(kind);
    if (cached) {
      setUrl(cached);
      return;
    }
    const update = () => {
      const u = cache.get(kind);
      if (u) setUrl(u);
    };
    subscribers.add(update);
    requestBake(kind);
    return () => {
      subscribers.delete(update);
    };
  }, [kind]);
  return url;
};

type Props = {
  kind: EnemyKind;
  className?: string;
  size?: number;
};

export const EnemyIcon = ({ kind, className, size }: Props) => {
  const url = useEnemyIconUrl(kind);
  const style: React.CSSProperties =
    size !== undefined ? { width: size, height: size } : { width: "100%", height: "100%" };
  if (!url) {
    return <div className={`enemy-icon enemy-icon-pending ${className ?? ""}`} style={style} />;
  }
  return (
    <img
      className={`enemy-icon ${className ?? ""}`}
      style={{ ...style, objectFit: "contain", display: "block" }}
      src={url}
      alt=""
      aria-hidden
    />
  );
};
