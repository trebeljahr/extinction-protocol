import { Environment, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { LEVELS } from "../levels";
import { BiomeGround } from "./BiomeGround";
import { BiomeProps } from "./BiomeProps";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";

// Level node bounds span x: [-24, 22], y: [-14, 26] — content grew taller
// after the 6-biome-band layout (alien band tops out at y=26).
const CONTENT_W = 80;
const CONTENT_H = 64;

// Rendered ground — oversized so the plane edge is always off-screen at
// any valid pan/zoom combination. Bumped up with content height so the
// south edge never appears, even on tall (portrait-ish) viewports where
// the bottom ray reaches several hundred world units past the cluster.
const GROUND_W = 1200;
const GROUND_H = 1000;

// How far the camera target can drift from origin before being clamped.
// Tight enough that the user can't pan the biome cluster off-screen.
const PAN_LIMIT_X = CONTENT_W / 2 - 14;
const PAN_LIMIT_Z = CONTENT_H / 2 - 8;

// Zoom is Three.js ortho zoom: higher = more zoomed in.
// At typical window widths (~1400px) zoom=16 fits the full node spread;
// zoom=42 is close enough for readable single-node inspection.
const MIN_ZOOM = 16;
const MAX_ZOOM = 42;

// Sky/fog tone — kept dim enough that mipmap-bloom on the canvas edge
// can't push it past the bloom threshold. Was #b8d0e4 / #c7dae8, but
// those bloomed into a hard white halo when the camera revealed any
// portion of the BG (e.g. a portrait viewport with the south plane
// edge in view).
const BG = "#3a4858";
const FOG = "#4a5868";
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
    // Lock the target to the ground plane. screenSpacePanning is off below
    // so this should stay at 0 already, but defensive: any future control
    // tweak that lets target.y drift would push the camera up/down and the
    // bottom rays would miss the ground entirely, exposing BG.
    const dx = cx - t.x;
    const dy = -t.y;
    const dz = cz - t.z;
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      t.x = cx;
      t.y = 0;
      t.z = cz;
      c.object.position.x += dx;
      c.object.position.y += dy;
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
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      // Touch defaults are ROTATE/DOLLY_PAN, but rotation is disabled
      // and the world map needs single-finger pan to feel right on
      // mobile. Two fingers still pinch-zoom + pan, matching the mouse
      // wheel + drag combo.
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      panSpeed={1.6}
      zoomSpeed={0.8}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // World-horizontal panning — drag-up/down maps to forward/back along
      // the ground plane (no Y drift), so the camera height stays fixed at
      // 30 and bottom rays always hit the ground. screenSpacePanning=true
      // tilted the pan axis with the camera and let target.y drift, which
      // pushed the camera below the plane on extreme drags and revealed BG.
      screenSpacePanning={false}
    />
  );
};

export const WorldMapScene = () => (
  <>
    <color attach="background" args={[BG]} />
    <fog attach="fog" args={[FOG, 80, 160]} />

    {/*
      Camera position determines the look angle once OrbitControls takes
      over (OrbitControls always re-orients the camera toward its target,
      which overrides the `rotation` prop). The target sits at (0,0,0) and
      the camera offset (0, 30, 11.36) gives forward = (0, -0.935, -0.354)
      — i.e. ~21° below vertical. A shallower angle (the previous z=22)
      caused the screen-space "up" vector to align too closely with world
      +Y, so the bottom rays of tall (portrait-ish) canvases started below
      the ground plane and revealed BG along the south horizon.
    */}
    <OrthographicCamera makeDefault position={[0, 30, 11.36]} zoom={18} near={0.1} far={200} />

    <ClampedControls />

    <Environment preset="park" background={false} environmentIntensity={0.6} />

    <ambientLight intensity={0.55} color="#eaf2ff" />
    <directionalLight
      position={[14, 26, 10]}
      intensity={2.2}
      color="#fff4dc"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
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

    {LEVELS.map((level) => (
      <LevelNode key={level.id} level={level} />
    ))}
  </>
);
