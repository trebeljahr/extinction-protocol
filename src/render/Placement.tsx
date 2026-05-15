import { type ThreeEvent, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { audio } from "../audio/AudioManager";
import { GAMEPAD_STICK_DEADZONE, scaleGamepadAxis, useGamepadInput } from "../input/gamepad";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import type { TowerKind } from "../sim/types";
import { TOWER_COST, TOWER_STATS } from "../sim/world";
import { useGame } from "../store";
import { GhostTower } from "./GhostTower";

type Vec2 = { x: number; y: number };

const TOUCH_PLACEMENT_OFFSET_PX = 84;
const TOUCH_PLACEMENT_STALE_MS = 900;
const TOUCH_CLICK_SUPPRESS_MS = 700;
// Window after a touch interaction during which gamepad cursor/button
// input is ignored on the play canvas. Stops accidental stick deflection
// from kicking the player out of an active touch placement, and prevents
// hint flicker when a touch device also has a paired controller idling.
const GAMEPAD_TOUCH_LOCKOUT_MS = 500;
const GAMEPAD_CURSOR_SPEED = 9;
const GAMEPAD_TOWER_ORDER: TowerKind[] = ["pulse", "chain", "flame", "hive", "mortar", "cryo"];

export const Placement = () => {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [touchAnchor, setTouchAnchor] = useState<Vec2 | null>(null);
  const [controllerHover, setControllerHover] = useState<Vec2 | null>(null);
  const [controllerActive, setControllerActive] = useState(false);
  const hoverRef = useRef<Vec2 | null>(null);
  const controllerHoverRef = useRef<Vec2 | null>(null);
  const controllerActiveRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const groundPointRef = useRef(new THREE.Vector3());
  const lastTouchPlacementRef = useRef<Vec2 | null>(null);
  const lastTouchPlacementAtRef = useRef(0);
  const touchPointersRef = useRef<Set<number>>(new Set());
  const multiTouchPlacementRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const lastTouchInputAtRef = useRef(0);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);
  const selectedKind = useGame((s) => s.selectedKind);
  // Subscribed so the placement plane re-renders (and re-runs the
  // towerAtPos / canPlace getState() reads below) when towers or trees
  // are added or removed. Without this, the plane only re-validated on
  // gold/status/selectedKind/hover changes, which silently went stale.
  useGame((s) => s.towerVersion);
  useGame((s) => s.treeVersion);

  const setHoverState = useCallback((pos: Vec2 | null) => {
    hoverRef.current = pos;
    setHover(pos);
  }, []);

  const setControllerHoverState = useCallback((pos: Vec2 | null) => {
    controllerHoverRef.current = pos;
    setControllerHover(pos);
  }, []);

  const setControllerActiveState = useCallback((active: boolean) => {
    controllerActiveRef.current = active;
    setControllerActive(active);
  }, []);

  const pointFromScreen = (clientX: number, clientY: number): Vec2 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );

    raycasterRef.current.setFromCamera(ndc, camera);
    const hit = raycasterRef.current.ray.intersectPlane(
      groundPlaneRef.current,
      groundPointRef.current,
    );
    if (!hit) return null;
    return { x: hit.x, y: -hit.z };
  };

  const eventPoint = (e: ThreeEvent<PointerEvent | MouseEvent>, offsetY = 0): Vec2 => {
    const clientX = e.nativeEvent.clientX;
    const clientY = e.nativeEvent.clientY - offsetY;
    return pointFromScreen(clientX, clientY) ?? { x: e.point.x, y: -e.point.z };
  };

  const isTouchEvent = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    "pointerType" in e.nativeEvent && e.nativeEvent.pointerType === "touch";

  const clearTouchPlacement = useCallback(() => {
    setTouchAnchor(null);
    lastTouchPlacementRef.current = null;
    lastTouchPlacementAtRef.current = 0;
  }, []);

  const updateTouchPlacement = (e: ThreeEvent<PointerEvent>): Vec2 => {
    const pos = eventPoint(e, TOUCH_PLACEMENT_OFFSET_PX);
    setControllerActiveState(false);
    setHoverState(pos);
    setTouchAnchor(eventPoint(e, 0));
    lastTouchPlacementRef.current = pos;
    lastTouchPlacementAtRef.current = Date.now();
    return pos;
  };

  const touchPlacementCanConfirm = (pos: Vec2): boolean => {
    const state = useGame.getState();
    if (state.towerAtPos(pos)) return true;
    const kind = state.selectedKind;
    if (kind === null || state.ui.status !== "running") return false;
    if (!state.freeTowers && state.ui.gold < TOWER_COST[kind]) return false;
    return state.canPlace(pos);
  };

  useEffect(() => {
    if (!selectedKind) {
      setHoverState(null);
      clearTouchPlacement();
      setControllerHoverState(null);
      setControllerActiveState(false);
      touchPointersRef.current.clear();
      multiTouchPlacementRef.current = false;
      suppressClickUntilRef.current = 0;
    }
  }, [
    selectedKind,
    clearTouchPlacement,
    setControllerActiveState,
    setControllerHoverState,
    setHoverState,
  ]);

  useGamepadInput((frame) => {
    if (!frame.gamepad) {
      return;
    }

    const state = useGame.getState();
    if (
      state.screen !== "playing" ||
      state.ui.status !== "running" ||
      state.compendiumOpen ||
      state.achievementsOpen ||
      state.creditsOpen ||
      state.difficultyPickerOpen ||
      state.levelIntroVisible ||
      state.newEnemyQueue.length > 0
    ) {
      return;
    }

    // Suppress stick/cursor input briefly after a touch so accidental
    // controller contact doesn't override an in-progress finger gesture.
    // Button presses (pause, call-wave, cycle) still go through — those
    // are deliberate and not subject to the same conflict.
    const touchLocked = Date.now() - lastTouchInputAtRef.current < GAMEPAD_TOUCH_LOCKOUT_MS;

    if (frame.buttonPressed("start")) state.togglePause();
    if (frame.buttonPressed("y")) state.callWaveEarly();

    const cycleTower = (direction: -1 | 1) => {
      const currentIndex = state.selectedKind
        ? GAMEPAD_TOWER_ORDER.indexOf(state.selectedKind)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : GAMEPAD_TOWER_ORDER.length - 1
          : (currentIndex + direction + GAMEPAD_TOWER_ORDER.length) % GAMEPAD_TOWER_ORDER.length;
      state.setSelectedKind(GAMEPAD_TOWER_ORDER[nextIndex]);
      setControllerActiveState(true);
      clearTouchPlacement();
    };

    if (frame.buttonPressed("lb")) cycleTower(-1);
    if (frame.buttonPressed("rb")) cycleTower(1);

    if (frame.buttonPressed("b")) {
      if (
        state.selectedKind ||
        state.ui.selectedTowerId ||
        state.selectedTreeId ||
        state.selectedRockId
      ) {
        state.clearSelection();
      } else if (state.ui.status === "running" || state.ui.status === "paused") {
        state.togglePause();
      }
    }

    const dpadX = Number(frame.buttonDown("right")) - Number(frame.buttonDown("left"));
    const dpadY = Number(frame.buttonDown("down")) - Number(frame.buttonDown("up"));
    const leftX = scaleGamepadAxis(frame.axis("leftX"), GAMEPAD_STICK_DEADZONE);
    const leftY = scaleGamepadAxis(frame.axis("leftY"), GAMEPAD_STICK_DEADZONE);
    const rightX = scaleGamepadAxis(frame.axis("rightX"), GAMEPAD_STICK_DEADZONE);
    const rightY = scaleGamepadAxis(frame.axis("rightY"), GAMEPAD_STICK_DEADZONE);
    // Pick the stronger deflection per axis so a player using both
    // sticks at once doesn't lose one to the OR short-circuit. Either
    // stick can drive the cursor; whichever is pushed harder wins.
    const stickX = Math.abs(rightX) >= Math.abs(leftX) ? rightX : leftX;
    const stickY = Math.abs(rightY) >= Math.abs(leftY) ? rightY : leftY;
    const moveX = dpadX || stickX;
    const moveY = dpadY || stickY;

    if ((moveX || moveY) && !touchLocked) {
      const base = controllerHoverRef.current ?? hoverRef.current ?? { x: 0, y: 0 };
      const next = {
        x: THREE.MathUtils.clamp(
          base.x + moveX * GAMEPAD_CURSOR_SPEED * frame.delta,
          -MAP_WIDTH / 2 + 0.5,
          MAP_WIDTH / 2 - 0.5,
        ),
        y: THREE.MathUtils.clamp(
          base.y - moveY * GAMEPAD_CURSOR_SPEED * frame.delta,
          -MAP_HEIGHT / 2 + 0.5,
          MAP_HEIGHT / 2 - 0.5,
        ),
      };
      setControllerActiveState(true);
      setControllerHoverState(next);
      clearTouchPlacement();
    }

    if (frame.buttonPressed("a") && !touchLocked) {
      const pos = controllerHoverRef.current ?? hoverRef.current ?? { x: 0, y: 0 };
      if (state.towerAtPos(pos)) audio.ui("select");
      state.tryPlaceOrSelect(pos);
      setControllerActiveState(true);
      setControllerHoverState(pos);
    }
  });

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isTouchEvent(e)) lastTouchInputAtRef.current = Date.now();
    if (isTouchEvent(e) && selectedKind && multiTouchPlacementRef.current) return;
    if (isTouchEvent(e) && selectedKind) {
      updateTouchPlacement(e);
      return;
    }

    const pos = eventPoint(e);
    setControllerActiveState(false);
    setHoverState(pos);
    clearTouchPlacement();
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isTouchEvent(e)) {
      lastTouchInputAtRef.current = Date.now();
      touchPointersRef.current.add(e.nativeEvent.pointerId);
      if (selectedKind && touchPointersRef.current.size > 1) {
        multiTouchPlacementRef.current = true;
        clearTouchPlacement();
        return;
      }
    }
    onPointerMove(e);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isTouchEvent(e)) return;
    lastTouchInputAtRef.current = Date.now();

    const wasMultiTouch = multiTouchPlacementRef.current || touchPointersRef.current.size > 1;
    touchPointersRef.current.delete(e.nativeEvent.pointerId);
    if (touchPointersRef.current.size === 0) multiTouchPlacementRef.current = false;
    if (!selectedKind) return;

    // Multi-touch always suppresses the synthetic click — the remaining
    // finger isn't a tap intent. For a single-finger lift, only suppress
    // once we've actually committed a placement, so a failed canConfirm
    // doesn't lock the player out of the next ~700ms of clicks.
    if (wasMultiTouch) {
      suppressClickUntilRef.current = Date.now() + TOUCH_CLICK_SUPPRESS_MS;
      return;
    }

    const hasFreshTouchPlacement =
      lastTouchPlacementRef.current !== null &&
      Date.now() - lastTouchPlacementAtRef.current < TOUCH_PLACEMENT_STALE_MS;
    const pos = hasFreshTouchPlacement ? lastTouchPlacementRef.current! : updateTouchPlacement(e);
    if (!touchPlacementCanConfirm(pos)) return;

    suppressClickUntilRef.current = Date.now() + TOUCH_CLICK_SUPPRESS_MS;
    if (useGame.getState().towerAtPos(pos)) audio.ui("select");
    useGame.getState().tryPlaceOrSelect(pos);
  };

  const onPointerCancel = (e: ThreeEvent<PointerEvent>) => {
    if (!isTouchEvent(e)) return;
    lastTouchInputAtRef.current = Date.now();
    touchPointersRef.current.delete(e.nativeEvent.pointerId);
    if (touchPointersRef.current.size === 0) multiTouchPlacementRef.current = false;
  };

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    if (isTouchEvent(e) && selectedKind) return;
    if (!controllerActiveRef.current) {
      setHoverState(null);
      clearTouchPlacement();
    }
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (Date.now() < suppressClickUntilRef.current) return;
    const hasFreshTouchPlacement =
      lastTouchPlacementRef.current !== null &&
      Date.now() - lastTouchPlacementAtRef.current < TOUCH_PLACEMENT_STALE_MS;
    const pos =
      selectedKind && hasFreshTouchPlacement ? lastTouchPlacementRef.current! : eventPoint(e);
    if (useGame.getState().towerAtPos(pos)) audio.ui("select");
    useGame.getState().tryPlaceOrSelect(pos);
  };

  const activeHover = controllerActive && controllerHover ? controllerHover : hover;
  const hoveredTower = activeHover !== null ? useGame.getState().towerAtPos(activeHover) : null;

  const showPlacement =
    activeHover !== null && hoveredTower === null && status === "running" && selectedKind !== null;

  const canPlaceHere =
    showPlacement && gold >= TOWER_COST[selectedKind!] && useGame.getState().canPlace(activeHover!);

  const placementColor = canPlaceHere ? "#3dff8a" : "#ff5a7a";
  const range = selectedKind ? TOWER_STATS[selectedKind].range : 0;

  const geom = useMemo(() => new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT), []);
  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <group>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: this is an
          r3f canvas mesh, not a DOM element — pointer events are how
          three.js exposes click/hover on 3D geometry. */}
      <mesh
        geometry={geom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerOut={onPointerOut}
        onClick={onClick}
        visible={false}
      />

      {activeHover && status === "running" && hoveredTower && (
        <group position={[hoveredTower.pos.x, 0, -hoveredTower.pos.y]}>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.9, 32]} />
            <meshBasicMaterial color="#ffd66a" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[hoveredTower.range - 0.04, hoveredTower.range, 64]} />
            <meshBasicMaterial color="#ffd66a" transparent opacity={0.22} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {showPlacement && touchAnchor && !controllerActive && (
        <group position={[touchAnchor.x, 0, -touchAnchor.y]}>
          <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.16, 0.26, 32]} />
            <meshBasicMaterial color="#93c5fd" transparent opacity={0.34} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {showPlacement && (
        <>
          <group position={[activeHover!.x, 0, -activeHover!.y]}>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.55, 0.7, 24]} />
              <meshBasicMaterial
                color={placementColor}
                transparent
                opacity={0.9}
                depthTest={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <PlacementCrosshair color={placementColor} />
            {canPlaceHere && (
              <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[range - 0.04, range, 64]} />
                <meshBasicMaterial
                  color={placementColor}
                  transparent
                  opacity={0.25}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
          <Suspense fallback={null}>
            <GhostTower kind={selectedKind!} pos={activeHover!} ok={canPlaceHere} />
          </Suspense>
        </>
      )}
    </group>
  );
};

const PlacementCrosshair = ({ color }: { color: string }) => (
  <>
    <mesh position={[0.48, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.36, 0.045]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} />
    </mesh>
    <mesh position={[-0.48, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.36, 0.045]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} />
    </mesh>
    <mesh position={[0, 0.05, 0.48]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.045, 0.36]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} />
    </mesh>
    <mesh position={[0, 0.05, -0.48]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.045, 0.36]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthTest={false} />
    </mesh>
  </>
);
