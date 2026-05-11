import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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

    useDragGate(
      controlsRef,
      reserveLeftClick,
      useThree((s) => s.gl),
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
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
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
    let startX = 0;
    let startY = 0;
    let gated = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (DRAG_GATE in e) return;

      startX = e.clientX;
      startY = e.clientY;
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
      if (!gated) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;

      gated = false;

      const synth = new PointerEvent("pointerdown", {
        clientX: startX,
        clientY: startY,
        button: 0,
        buttons: 1,
        pointerId: e.pointerId,
        pointerType: "mouse",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(synth, DRAG_GATE, { value: true });
      canvas.dispatchEvent(synth);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      gated = false;
    };

    canvas.addEventListener("pointerdown", onDown, { capture: true });
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [gl, controlsRef, active]);
}
