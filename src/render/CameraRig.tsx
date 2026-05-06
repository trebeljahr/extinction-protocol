import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { OrthographicCamera as OrthographicCameraImpl } from "three";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { useGame } from "../store";

// Pan limits — keep the playfield mostly on screen at all zoom levels.
// Tuned generously: the player can drift the camera over an edge to
// peek at a corner tower, but can't lose the path entirely.
const PAN_LIMIT_X = MAP_WIDTH * 0.4;
const PAN_LIMIT_Z = MAP_HEIGHT * 0.4;

// Half-width of the playable horizontal extent: every level's path
// enters/exits at x = ±20, so this matches the entry/exit X.
const PATH_HALF_X = MAP_WIDTH / 2;

// Camera tilt is rotation.x = -π/3 (60° pitch). One pixel along the
// camera's screen-up axis at zoom Z corresponds to ~0.577/Z world units
// on the ground plane in the Z (north/south) direction. Derived from
// projecting the screen-up basis (0, 0.5, -0.866) along the look ray
// (0, -0.866, -0.5) onto y=0: dz/dpx = -(0.866 + 0.5²/0.866) = -1.155,
// so half-extent factor is 0.577. See doc-comment on computeFitZoom.
const TILT_HALF_FACTOR = 0.577;

// Floor on the path's vertical half-extent. Levels with shallow
// up-down meandering (e.g. straight-across paths at y=0) shouldn't
// zoom in absurdly far — clamp to a sensible minimum so paths still
// have visual breathing room above/below.
const MIN_PATH_HALF_Z = 8;

// How far the player can manually zoom in past the fit-to-edge zoom.
// 2.5× covers reading tower upgrade details up close. Zooming out
// past the fit zoom is disallowed — that would re-expose background.
const MAX_ZOOM_MULT = 2.5;

const computeMaxPathExtentZ = (paths: { x: number; y: number }[][]): number => {
  let m = 0;
  for (const p of paths) for (const v of p) m = Math.max(m, Math.abs(v.y));
  return m;
};

// Zoom that sits the path's horizontal edges (x=±20) on the screen
// edges and keeps the path's vertical extent on screen. Uses min() so
// the binding constraint wins: on narrow viewports the X edges hit
// first; on ultrawide the Z edges hit first.
const computeFitZoom = (width: number, height: number, pathHalfZ: number): number => {
  const fitZoomX = width / (2 * PATH_HALF_X);
  const fitZoomZ = (TILT_HALF_FACTOR * height) / Math.max(pathHalfZ, MIN_PATH_HALF_Z);
  return Math.min(fitZoomX, fitZoomZ);
};

export const CameraRig = () => {
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<OrthographicCameraImpl>(null);

  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);
  const size = useThree((s) => s.size);

  // Local one-shot rumble triggered when the run flips to "lost". The
  // sim loop stops ticking on loss (so world.shake stops decaying), and
  // the per-tick shake never fires on loss anyway — handle it entirely
  // here. lossShakeStart is the wall-clock ms when the rumble began;
  // null means inactive. prevStatus tracks the transition into "lost".
  const lossShakeStartRef = useRef<number | null>(null);
  const prevStatusRef = useRef(useGame.getState().world.status);

  const pathHalfZ = useMemo(() => computeMaxPathExtentZ(paths), [paths]);
  const fitZoom = useMemo(
    () => computeFitZoom(size.width, size.height, pathHalfZ),
    [size.width, size.height, pathHalfZ],
  );
  const maxZoom = fitZoom * MAX_ZOOM_MULT;

  // Reset to fit-zoom baseline whenever the level changes or the
  // viewport resizes. Manual zoom is preserved within a level — the
  // player keeps whatever they pinched/scrolled to until the next
  // level or window resize.
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam) return;
    cam.zoom = fitZoom;
    cam.updateProjectionMatrix();
    if (ctrls) ctrls.update();
    // levelId is intentional: re-baselines on level change. fitZoom
    // re-baselines on viewport resize.
  }, [levelId, fitZoom]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const { world } = useGame.getState();
    const status = world.status;
    if (status === "lost" && prevStatusRef.current !== "lost") {
      lossShakeStartRef.current = performance.now();
    }
    if (status === "running") lossShakeStartRef.current = null;
    prevStatusRef.current = status;

    let mag = status === "running" ? world.shake.magnitude : 0;
    const lossStart = lossShakeStartRef.current;
    if (lossStart !== null) {
      // 600ms ease-out (cubic): magnitude 0.6 → 0.
      const t = Math.min(1, (performance.now() - lossStart) / 600);
      const ease = 1 - t;
      const lossMag = 0.6 * ease * ease * ease;
      if (lossMag > mag) mag = lossMag;
      if (t >= 1) lossShakeStartRef.current = null;
    }
    if (mag > 0.001) {
      g.position.x = (Math.random() - 0.5) * mag;
      g.position.z = (Math.random() - 0.5) * mag;
    } else {
      g.position.set(0, 0, 0);
    }

    // Pan-clamp identical idiom to WorldMap.ClampedControls: keep the
    // OrbitControls target inside the playfield, then translate the
    // camera by the same delta so the look-direction stays fixed.
    // Without this the player could pan the entire scene off-screen
    // (especially easy on touch with a wide swipe).
    const c = controlsRef.current;
    if (!c) return;
    const t = c.target;
    const cx = THREE.MathUtils.clamp(t.x, -PAN_LIMIT_X, PAN_LIMIT_X);
    const cz = THREE.MathUtils.clamp(t.z, -PAN_LIMIT_Z, PAN_LIMIT_Z);
    const dx = cx - t.x;
    const dy = -t.y; // keep target glued to the ground plane
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
    <group ref={groupRef}>
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[0, 24, 14]}
        rotation={[-Math.PI / 3, 0, 0]}
        zoom={fitZoom}
        near={0.1}
        far={200}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        enablePan
        enableZoom
        // Mouse: left-click is reserved for tower placement / selection
        // — disable it for pan so it falls through to the Placement
        // mesh raycaster. Right-click pans, scroll zooms.
        mouseButtons={{
          LEFT: -1 as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        // Touch: one finger pans (matches the world map). A no-move
        // tap still passes through to the canvas, so placement on
        // mobile keeps working. Pinch zooms; two-finger drag also pans.
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        panSpeed={1.4}
        zoomSpeed={0.9}
        minZoom={fitZoom}
        maxZoom={maxZoom}
        // World-horizontal pan — drag-up moves the look point along
        // the ground plane (forward), not along screen-space-up. Keeps
        // the camera height fixed so the bottom of the frame never
        // shows past the map edge.
        screenSpacePanning={false}
      />
    </group>
  );
};
