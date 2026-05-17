import { OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { OrthographicCamera as OrthographicCameraImpl } from "three";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { useGame } from "../store";
import { MapOrbitControls } from "./useMapGestures";

const CAMERA_BASE_POSITION: [number, number, number] = [0, 24, 14];

// Battle camera orbit clamps. Base position sits at polar ≈ 0.528 rad
// (≈30° from world +Y). Allow a small tilt window so the player can hint
// the scene is 3D without flipping to top-down or dipping under the
// ground plane and exposing background.
const BATTLE_MIN_POLAR = 0.35;
const BATTLE_MAX_POLAR = 0.75;

// Pan limits — keep the playfield mostly on screen at all zoom levels.
// Tuned generously: the player can drift the camera over an edge to
// peek at a corner tower, but can't lose the path entirely.
const PAN_LIMIT_X = MAP_WIDTH * 0.4;
const PAN_LIMIT_Z = MAP_HEIGHT * 0.4;

// Camera tilt is rotation.x ≈ -π/3 (60° pitch). One pixel along the
// camera's screen-up axis at zoom Z corresponds to ~0.577/Z world units
// on the ground plane in the Z (north/south) direction. The camera at
// (0, 24, 14) looks toward the origin with look = (0, -0.838, -0.489),
// and the ortho viewport is a parallelepiped, so visible Z extent on
// ground is symmetric around z=0 with half-extent ≈ 0.577*height/Z.
const TILT_HALF_FACTOR = 0.577;

// Decoration margin past the play area — at the most-zoomed-out zoom,
// this much decor is visible past the playable rectangle on each side.
// Large enough that the playfield doesn't feel claustrophobic; small
// enough that the camera can never zoom out far enough to reveal the
// far ground plane edge or the scene background past it.
const DECOR_MARGIN_X = 4;
const DECOR_MARGIN_Z = 3;

// Mobile gets a larger Z margin so the HUD bands (top wave banner,
// bottom tower picker) don't crop the playable area. Without this the
// fit zoom on landscape phones cuts off path endpoints behind the HUD.
const MOBILE_VIEWPORT_PX = 720;
const MOBILE_DECOR_MARGIN_Z = 6;

// How far the player can manually zoom in past the fit-to-edge zoom.
// 2.5× covers reading tower upgrade details up close. Zooming out
// past the fit zoom is disallowed — that would re-expose background.
const MAX_ZOOM_MULT = 2.5;

// Hard ceiling on zoom-in regardless of fit zoom. Values past this
// turn each world unit into ~80+ CSS px, which makes tower models
// blocky and the placement reticle feel sluggish. Capping here keeps
// readability sensible on huge viewports where fit zoom alone would
// already be high.
const ABS_MAX_ZOOM = 80;

// Skip the off-map lead-in slice — its points sit past the playfield
// border by design and shouldn't pull the fit zoom outward (that would
// expose the lead-in on screen, defeating the purpose).
const computeMaxPathExtentZ = (
  paths: { x: number; y: number }[][],
  ribbonStart: number[],
): number => {
  let m = 0;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const start = ribbonStart[i] ?? 0;
    for (let j = start; j < p.length; j++) m = Math.max(m, Math.abs(p[j].y));
  }
  return m;
};

// Most-zoomed-out zoom — guarantees the playable area + decor margin
// fits on screen on both axes. Uses min() so the binding constraint
// wins: on narrow viewports the X edges hit first, on ultrawide the
// Z edges hit first. The half-extent is max(playArea, pathExtent)
// because some levels have paths that meander outside the play
// rectangle's vertical band; pulling them in too is friendlier.
const computeFitZoom = (width: number, height: number, pathHalfZ: number): number => {
  const mobile = width <= MOBILE_VIEWPORT_PX || height <= 500;
  const marginZ = mobile ? MOBILE_DECOR_MARGIN_Z : DECOR_MARGIN_Z;
  const halfX = MAP_WIDTH / 2 + DECOR_MARGIN_X;
  const halfZ = Math.max(MAP_HEIGHT / 2, pathHalfZ) + marginZ;
  const fitZoomX = width / (2 * halfX);
  const fitZoomZ = (TILT_HALF_FACTOR * height) / halfZ;
  return Math.min(fitZoomX, fitZoomZ);
};

export const CameraRig = () => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<OrthographicCameraImpl>(null);

  const paths = useGame((s) => s.world.paths);
  const pathRibbonStart = useGame((s) => s.world.pathRibbonStart);
  const levelId = useGame((s) => s.world.levelId);
  const selectedKind = useGame((s) => s.selectedKind);
  const status = useGame((s) => s.world.status);
  const size = useThree((s) => s.size);

  // Local one-shot rumble triggered when the run flips to "lost". The
  // sim loop stops ticking on loss (so world.shake stops decaying), and
  // the per-tick shake never fires on loss anyway — handle it entirely
  // here. lossShakeStart is the wall-clock ms when the rumble began;
  // null means inactive. prevStatus tracks the transition into "lost".
  const lossShakeStartRef = useRef<number | null>(null);
  const prevStatusRef = useRef(useGame.getState().world.status);
  // Last applied shake offset (in world XZ). Re-applied each frame as a
  // delta to BOTH camera.position and controls.target so OrbitControls'
  // lookAt(target) keeps the same view direction — the shake reads as
  // pure screen translation. Wrapping the camera in a parent group
  // (the old approach) instead moved the camera in world space while
  // target stayed pinned at (0,0,0), so lookAt re-aimed every frame and
  // the loss rumble visibly rotated the whole map.
  const shakeOffsetRef = useRef({ x: 0, z: 0 });

  const pathHalfZ = useMemo(
    () => computeMaxPathExtentZ(paths, pathRibbonStart),
    [paths, pathRibbonStart],
  );
  const fitZoom = useMemo(
    () => computeFitZoom(size.width, size.height, pathHalfZ),
    [size.width, size.height, pathHalfZ],
  );
  const maxZoom = Math.min(fitZoom * MAX_ZOOM_MULT, ABS_MAX_ZOOM);

  // Reset to the fit baseline whenever the level changes or the
  // viewport resizes. Re-centre pan too; otherwise a prior level's
  // drag offset can carry into the new fit and make mobile starts
  // feel cropped even though the zoom itself reset correctly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: levelId is intentional
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam) return;
    cam.position.set(...CAMERA_BASE_POSITION);
    cam.zoom = fitZoom;
    cam.updateProjectionMatrix();
    if (ctrls) {
      ctrls.target.set(0, 0, 0);
      ctrls.update();
    }
  }, [levelId, fitZoom]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const ctrls = controlsRef.current;
    const { world } = useGame.getState();
    const curStatus = world.status;
    if (curStatus === "lost" && prevStatusRef.current !== "lost") {
      lossShakeStartRef.current = performance.now();
    }
    if (curStatus === "running") lossShakeStartRef.current = null;
    prevStatusRef.current = curStatus;

    let mag = curStatus === "running" ? world.shake.magnitude : 0;
    const lossStart = lossShakeStartRef.current;
    if (lossStart !== null) {
      // 600ms ease-out (cubic): magnitude 0.6 → 0.
      const t = Math.min(1, (performance.now() - lossStart) / 600);
      const ease = 1 - t;
      const lossMag = 0.6 * ease * ease * ease;
      if (lossMag > mag) mag = lossMag;
      if (t >= 1) lossShakeStartRef.current = null;
    }

    const desiredX = mag > 0.001 ? (Math.random() - 0.5) * mag : 0;
    const desiredZ = mag > 0.001 ? (Math.random() - 0.5) * mag : 0;
    const last = shakeOffsetRef.current;
    const dx = desiredX - last.x;
    const dz = desiredZ - last.z;
    if (dx !== 0 || dz !== 0) {
      cam.position.x += dx;
      cam.position.z += dz;
      if (ctrls) {
        ctrls.target.x += dx;
        ctrls.target.z += dz;
      }
      last.x = desiredX;
      last.z = desiredZ;
    }
  });

  return (
    <>
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={CAMERA_BASE_POSITION}
        rotation={[-Math.PI / 3, 0, 0]}
        zoom={fitZoom}
        near={0.1}
        far={200}
      />
      <MapOrbitControls
        ref={controlsRef}
        panLimitX={PAN_LIMIT_X}
        panLimitZ={PAN_LIMIT_Z}
        minZoom={fitZoom}
        maxZoom={maxZoom}
        panSpeed={1.4}
        zoomSpeed={0.9}
        reserveLeftClick
        reserveTouchPlacement={selectedKind !== null}
        // Yaw + small pitch hint that the playfield is 3D. Disabled while
        // a tower is armed because the placement gesture maps one-finger
        // touch to ROTATE as a no-op — leaving rotate enabled there would
        // spin the camera mid-placement. Also disabled once the run is
        // lost so the HQ-death rumble doesn't get mistaken for a rotate
        // gesture and spin the whole map under the player. Right-mouse
        // drag on desktop, two-finger twist on mobile (DOLLY_ROTATE keeps
        // pinch zoom).
        enableRotate={selectedKind === null && status !== "lost"}
        minPolarAngle={BATTLE_MIN_POLAR}
        maxPolarAngle={BATTLE_MAX_POLAR}
        rotateSpeed={0.6}
        touchTwo={THREE.TOUCH.DOLLY_ROTATE}
      />
    </>
  );
};
