import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// Shared zoom/pan/drag setup for the world-map and in-level cameras.
// Both views are top-down ortho with the same gesture vocabulary —
// one-finger pan, two-finger pinch + drag, scroll-zoom — so factoring
// the OrbitControls config + the per-frame target clamp into one
// component keeps the two cameras consistent.
//
// The clamp idiom: each frame, snap the controls' target back into
// [-panLimitX, panLimitX] × [-panLimitZ, panLimitZ] on the ground
// plane (y=0), then translate the camera by the same delta so the
// look-direction stays fixed. Without this, a wide swipe on touch can
// drift the entire scene off-screen.
//
// Tap-to-place compatibility: r3f's onClick fires on pointerup only
// when the pointer didn't move past the canvas's tap-threshold (a few
// CSS pixels). OrbitControls' pointer capture during a real drag
// silences r3f's click for that gesture. So a brief tap with no
// movement still hits the placement plane; a drag swipes the camera.
// `reserveLeftClick: true` additionally disables OrbitControls' left
// mouse pan, so desktop left-clicks fall through to placement instead
// of getting eaten by a pan gesture that started on a click.

export type MapGestureConfig = {
  panLimitX: number;
  panLimitZ: number;
  minZoom: number;
  maxZoom: number;
  panSpeed?: number;
  zoomSpeed?: number;
  // When true, left-mouse is reserved for the canvas (tap-to-place).
  // Pan still works via right-mouse and one-finger touch. Used
  // in-level so left-click selects/places towers.
  reserveLeftClick?: boolean;
};

export const MapOrbitControls = forwardRef<OrbitControlsImpl | null, MapGestureConfig>(
  function MapOrbitControls(
    {
      panLimitX,
      panLimitZ,
      minZoom,
      maxZoom,
      panSpeed = 1.4,
      zoomSpeed = 0.9,
      reserveLeftClick = false,
    },
    ref,
  ) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    useImperativeHandle<OrbitControlsImpl | null, OrbitControlsImpl | null>(
      ref,
      () => controlsRef.current,
    );

    // Avoid feedback loop: only translate the camera by the clamp delta
    // once per frame. Lock target.y to 0 too — any future tweak that
    // lets target.y drift would tilt the look ray off the ground plane
    // and bottom-of-screen rays would miss the ground entirely,
    // exposing the scene background.
    useFrame(() => {
      const c = controlsRef.current;
      if (!c) return;
      const t = c.target;
      const cx = THREE.MathUtils.clamp(t.x, -panLimitX, panLimitX);
      const cz = THREE.MathUtils.clamp(t.z, -panLimitZ, panLimitZ);
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

    const mouseButtons = reserveLeftClick
      ? {
          // Left disabled — falls through to the canvas raycaster so
          // tower placement / selection still works on desktop.
          LEFT: -1 as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }
      : {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };

    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        enablePan
        enableZoom
        mouseButtons={mouseButtons}
        // Touch defaults are ROTATE/DOLLY_PAN, but rotation is disabled
        // and these maps need single-finger pan to feel right on
        // mobile. Two fingers pinch-zoom + pan (DOLLY_PAN), matching
        // the mouse wheel + drag combo on desktop.
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        panSpeed={panSpeed}
        zoomSpeed={zoomSpeed}
        minZoom={minZoom}
        maxZoom={maxZoom}
        // World-horizontal pan — drag-up moves the look point along
        // the ground plane (forward), not along screen-space-up. Keeps
        // the camera height fixed so the bottom of the frame never
        // shows past the map edge.
        screenSpacePanning={false}
      />
    );
  },
);
