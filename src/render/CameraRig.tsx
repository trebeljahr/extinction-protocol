import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { useGame } from "../store";

// Pan limits — keep the playfield mostly on screen at all zoom levels.
// Tuned generously: the player can drift the camera over an edge to
// peek at a corner tower, but can't lose the path entirely.
const PAN_LIMIT_X = MAP_WIDTH * 0.4;
const PAN_LIMIT_Z = MAP_HEIGHT * 0.4;

// Ortho zoom range. Default 28 fits the full map at 16:9. Min 18 lets
// the player zoom out a touch (helpful on tall portrait views even
// though we nudge them to landscape); max 70 zooms close enough to
// read tower upgrade details without occlusion.
const MIN_ZOOM = 18;
const MAX_ZOOM = 70;
const DEFAULT_ZOOM = 28;

export const CameraRig = () => {
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const { world } = useGame.getState();
    const mag = world.status === "running" ? world.shake.magnitude : 0;
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
        makeDefault
        position={[0, 24, 14]}
        rotation={[-Math.PI / 3, 0, 0]}
        zoom={DEFAULT_ZOOM}
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
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        // World-horizontal pan — drag-up moves the look point along
        // the ground plane (forward), not along screen-space-up. Keeps
        // the camera height fixed so the bottom of the frame never
        // shows past the map edge.
        screenSpacePanning={false}
      />
    </group>
  );
};
