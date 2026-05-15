import { Environment, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { OrthographicCamera as OrthographicCameraImpl } from "three";
import { LEVELS } from "../levels";
import { BiomeGround } from "./BiomeGround";
import { BiomeProps } from "./BiomeProps";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";
import { MapOrbitControls } from "./useMapGestures";

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

// Camera tilt: forward = (0, -0.935, -0.354) → the screen-up axis
// projects onto the ground plane stretched by 1/0.935. So the visible
// Z extent on the ground at zoom Z is (height/Z) / 0.935.
const TILT_GROUND_FACTOR = 1 / 0.935;

// Hard ceiling on zoom-in. Past this, single nodes overflow the viewport
// and the labels become unreadable from oversampling.
const ABS_MAX_ZOOM = 42;
// How far past the fit zoom the player can manually zoom in.
const MAX_ZOOM_MULT = 2.5;

// Smallest zoom we'll ever pick. Keeps short/wide viewports from showing
// a tiny postage-stamp map while still letting normal phones land on a
// looser fit when the height-fit math comes out below this.
const MIN_FIT_ZOOM = 8;

const computeFitZoom = (width: number, height: number): number => {
  const halfX = CONTENT_W / 2;
  const halfZ = CONTENT_H / 2;
  const fitX = width / (2 * halfX);
  const fitZ = (height * TILT_GROUND_FACTOR) / (2 * halfZ);
  return Math.max(MIN_FIT_ZOOM, Math.min(fitX, fitZ));
};

// Sky/fog tone — kept dim enough that mipmap-bloom on the canvas edge
// can't push it past the bloom threshold. Was #b8d0e4 / #c7dae8, but
// those bloomed into a hard white halo when the camera revealed any
// portion of the BG (e.g. a portrait viewport with the south plane
// edge in view).
const BG = "#3a4858";
const FOG = "#4a5868";
const HEMI_TOP = "#d6e6f4";
const HEMI_BOTTOM = "#7a6848";

const MapCamera = ({ fitZoom }: { fitZoom: number }) => {
  const cameraRef = useRef<OrthographicCameraImpl>(null);
  // Re-seat the camera at the fit baseline whenever the viewport-derived
  // fit zoom changes (resize / orientation flip). Without this the map
  // stays at the previous zoom even after the viewport changes shape.
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.zoom = fitZoom;
    cam.updateProjectionMatrix();
  }, [fitZoom]);
  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[0, 30, 11.36]}
      zoom={fitZoom}
      near={0.1}
      far={200}
    />
  );
};

export const WorldMapScene = () => {
  const size = useThree((s) => s.size);
  const fitZoom = useMemo(() => computeFitZoom(size.width, size.height), [size.width, size.height]);
  const maxZoom = Math.min(fitZoom * MAX_ZOOM_MULT, ABS_MAX_ZOOM);
  return (
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

      Initial zoom is computed from the viewport so phones don't open
      half-cropped. Used as both the camera's starting zoom and the
      OrbitControls minZoom (zooming out further would expose BG).
    */}
      <MapCamera fitZoom={fitZoom} />

      <MapOrbitControls
        panLimitX={PAN_LIMIT_X}
        panLimitZ={PAN_LIMIT_Z}
        minZoom={fitZoom}
        maxZoom={maxZoom}
        panSpeed={1.6}
        zoomSpeed={0.8}
      />

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
};
