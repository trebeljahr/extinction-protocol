import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type MapGestureConfig = {
  panLimitX: number;
  panLimitZ: number;
  minZoom: number;
  maxZoom: number;
  panSpeed?: number;
  zoomSpeed?: number;
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
    const gl = useThree((s) => s.gl);
    useImperativeHandle<OrbitControlsImpl | null, OrbitControlsImpl | null>(
      ref,
      () => controlsRef.current,
    );

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

    useDragGate(controlsRef, reserveLeftClick, gl);

    const touches = useMemo(
      () => ({
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }),
      [],
    );

    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        enablePan
        enableZoom
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={touches}
        panSpeed={panSpeed}
        zoomSpeed={zoomSpeed}
        minZoom={minZoom}
        maxZoom={maxZoom}
        screenSpacePanning={false}
      />
    );
  },
);

const DRAG_THRESHOLD_SQ = 25; // 5 px²
const DRAG_GATE = Symbol("dragGate");

function useDragGate(
  controlsRef: React.RefObject<OrbitControlsImpl | null>,
  active: boolean,
  gl: THREE.WebGLRenderer,
) {
  useEffect(() => {
    if (!active) return;

    const canvas = gl.domElement;
    const ownerDocument = canvas.ownerDocument;
    let startX = 0;
    let startY = 0;
    let pointerId = -1;
    let gated = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (DRAG_GATE in e) return;

      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      gated = true;

      const c = controlsRef.current;
      if (c) {
        c.enabled = false;
        queueMicrotask(() => {
          if (c) c.enabled = true;
        });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!gated || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;

      gated = false;

      const synthDown = new PointerEvent("pointerdown", {
        clientX: startX,
        clientY: startY,
        button: 0,
        buttons: 1,
        pointerId: e.pointerId,
        pointerType: "mouse",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(synthDown, DRAG_GATE, { value: true });
      canvas.dispatchEvent(synthDown);

      // Replay the threshold-crossing move too. Without this, pan only
      // begins on the *next* move event, which makes short drags feel
      // sticky or get misread as taps.
      ownerDocument.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: e.clientX,
          clientY: e.clientY,
          button: -1,
          buttons: 1,
          pointerId: e.pointerId,
          pointerType: "mouse",
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    const clearGate = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      gated = false;
      pointerId = -1;
    };

    canvas.addEventListener("pointerdown", onDown, { capture: true });
    ownerDocument.addEventListener("pointermove", onMove);
    ownerDocument.addEventListener("pointerup", clearGate);
    ownerDocument.addEventListener("pointercancel", clearGate);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, { capture: true });
      ownerDocument.removeEventListener("pointermove", onMove);
      ownerDocument.removeEventListener("pointerup", clearGate);
      ownerDocument.removeEventListener("pointercancel", clearGate);
    };
  }, [gl, controlsRef, active]);
}
