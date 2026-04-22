import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { LEVELS } from "../levels";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";
import { BiomeGround } from "./BiomeGround";
import { BiomeProps } from "./BiomeProps";

// Level node bounds span roughly x: [-30, 26], y: [-14, 18].
// Map content area — the region nodes + biome colors occupy.
const CONTENT_W = 80;
const CONTENT_H = 48;

// Rendered ground — oversized so the fallback-coloured outer ring is
// always off-screen at any valid pan/zoom combination.
const GROUND_W = 200;
const GROUND_H = 140;

// How far the camera target can drift from origin before being clamped.
// Tight enough that the user can't pan the biome cluster off-screen.
const PAN_LIMIT_X = CONTENT_W / 2 - 14;
const PAN_LIMIT_Z = CONTENT_H / 2 - 8;

// Zoom is Three.js ortho zoom: higher = more zoomed in.
// At typical window widths (~1400px) zoom=16 fits the full node spread;
// zoom=42 is close enough for readable single-node inspection.
const MIN_ZOOM = 16;
const MAX_ZOOM = 42;

const BG = "#b8d0e4";
const FOG = "#c7dae8";
const HEMI_TOP = "#d6e6f4";
const HEMI_BOTTOM = "#7a6848";

const ClampedControls = () => {
  const ref = useRef<OrbitControlsImpl | null>(null);
  // Avoid feedback loop: only shift camera by the clamp delta once per frame.
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const t = c.target;
    const cx = THREE.MathUtils.clamp(t.x, -PAN_LIMIT_X, PAN_LIMIT_X);
    const cz = THREE.MathUtils.clamp(t.z, -PAN_LIMIT_Z, PAN_LIMIT_Z);
    const dx = cx - t.x;
    const dz = cz - t.z;
    if (dx !== 0 || dz !== 0) {
      t.x = cx;
      t.z = cz;
      c.object.position.x += dx;
      c.object.position.z += dz;
    }
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan
      enableRotate={false}
      enableZoom
      mouseButtons={{
        LEFT: 2, // PAN
        MIDDLE: 1,
        RIGHT: 2,
      }}
      panSpeed={1.6}
      zoomSpeed={0.8}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      screenSpacePanning
    />
  );
};

export const WorldMapScene = () => (
  <>
    <color attach="background" args={[BG]} />
    <fog attach="fog" args={[FOG, 80, 160]} />

    <OrthographicCamera
      makeDefault
      position={[0, 30, 22]}
      rotation={[-Math.PI / 2.6, 0, 0]}
      zoom={18}
      near={0.1}
      far={200}
    />

    <ClampedControls />

    <Environment preset="park" background={false} environmentIntensity={0.6} />

    <ambientLight intensity={0.55} color="#eaf2ff" />
    <directionalLight
      position={[14, 26, 10]}
      intensity={2.2}
      color="#fff4dc"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-CONTENT_H}
      shadow-camera-right={CONTENT_H}
      shadow-camera-top={CONTENT_H}
      shadow-camera-bottom={-CONTENT_H}
      shadow-bias={-0.0005}
    />
    <hemisphereLight args={[HEMI_TOP, HEMI_BOTTOM, 0.85]} />

    <BiomeGround width={GROUND_W} height={GROUND_H} />
    <BiomeProps />

    <MapRoute />

    {LEVELS.map(level => (
      <LevelNode key={level.id} level={level} />
    ))}
  </>
);
