import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { audio } from "../audio/AudioManager";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import type { TowerKind } from "../sim/types";
import { TOWER_COST, TOWER_STATS } from "../sim/world";
import { useGame } from "../store";
import { GhostTower } from "./GhostTower";

type Vec2 = { x: number; y: number };

const TOUCH_PLACEMENT_OFFSET_PX = 68;
const GAMEPAD_CURSOR_SPEED = 9;
const GAMEPAD_DEADZONE = 0.18;
const GAMEPAD_BUTTONS = {
  a: 0,
  b: 1,
  y: 3,
  lb: 4,
  rb: 5,
  start: 9,
} as const;
const GAMEPAD_TOWER_ORDER: TowerKind[] = ["pulse", "chain", "flame", "hive", "mortar", "cryo"];

export const Placement = () => {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [touchAnchor, setTouchAnchor] = useState<Vec2 | null>(null);
  const [controllerHover, setControllerHover] = useState<Vec2 | null>(null);
  const [controllerActive, setControllerActive] = useState(false);
  const buttonPrevRef = useRef<boolean[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const groundPointRef = useRef(new THREE.Vector3());
  const lastTouchPlacementRef = useRef<Vec2 | null>(null);
  const lastTouchPlacementAtRef = useRef(0);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);
  const selectedKind = useGame((s) => s.selectedKind);
  // Subscribed so the placement plane re-renders (and re-runs the
  // towerAtPos / canPlace getState() reads below) when towers or trees
  // are added or removed. Without this, the plane only re-validated on
  // gold/status/selectedKind/hover changes, which silently went stale.
  useGame((s) => s.towerVersion);
  useGame((s) => s.treeVersion);

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

  useEffect(() => {
    if (!selectedKind) {
      setHover(null);
      setTouchAnchor(null);
      lastTouchPlacementRef.current = null;
      lastTouchPlacementAtRef.current = 0;
    }
  }, [selectedKind]);

  useFrame((_, delta) => {
    const pads = navigator.getGamepads?.();
    const gamepad = Array.from(pads ?? []).find((pad): pad is Gamepad => Boolean(pad?.connected));
    if (!gamepad) {
      buttonPrevRef.current = [];
      return;
    }

    const state = useGame.getState();
    const buttonDown = (index: number) => Boolean(gamepad.buttons[index]?.pressed);
    const buttonPressed = (index: number) => buttonDown(index) && !buttonPrevRef.current[index];
    const updatePressedState = () => {
      buttonPrevRef.current = gamepad.buttons.map((button) => button.pressed);
    };

    if (
      state.screen !== "playing" ||
      state.compendiumOpen ||
      state.achievementsOpen ||
      state.creditsOpen ||
      state.difficultyPickerOpen ||
      state.levelIntroVisible
    ) {
      updatePressedState();
      return;
    }

    if (buttonPressed(GAMEPAD_BUTTONS.start)) state.togglePause();
    if (buttonPressed(GAMEPAD_BUTTONS.y)) state.callWaveEarly();

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
      setControllerActive(true);
      setTouchAnchor(null);
      lastTouchPlacementRef.current = null;
      lastTouchPlacementAtRef.current = 0;
    };

    if (buttonPressed(GAMEPAD_BUTTONS.lb)) cycleTower(-1);
    if (buttonPressed(GAMEPAD_BUTTONS.rb)) cycleTower(1);

    if (buttonPressed(GAMEPAD_BUTTONS.b)) {
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

    const dpadX = Number(buttonDown(15)) - Number(buttonDown(14));
    const dpadY = Number(buttonDown(13)) - Number(buttonDown(12));
    const axisX = gamepad.axes[0] ?? 0;
    const axisY = gamepad.axes[1] ?? 0;
    const stickX = Math.abs(axisX) > GAMEPAD_DEADZONE ? axisX : 0;
    const stickY = Math.abs(axisY) > GAMEPAD_DEADZONE ? axisY : 0;
    const moveX = dpadX || stickX;
    const moveY = dpadY || stickY;

    if (moveX || moveY) {
      const base = controllerHover ?? hover ?? { x: 0, y: 0 };
      const next = {
        x: THREE.MathUtils.clamp(
          base.x + moveX * GAMEPAD_CURSOR_SPEED * delta,
          -MAP_WIDTH / 2 + 0.5,
          MAP_WIDTH / 2 - 0.5,
        ),
        y: THREE.MathUtils.clamp(
          base.y - moveY * GAMEPAD_CURSOR_SPEED * delta,
          -MAP_HEIGHT / 2 + 0.5,
          MAP_HEIGHT / 2 - 0.5,
        ),
      };
      setControllerActive(true);
      setControllerHover(next);
      setTouchAnchor(null);
      lastTouchPlacementRef.current = null;
      lastTouchPlacementAtRef.current = 0;
    }

    if (buttonPressed(GAMEPAD_BUTTONS.a)) {
      const pos = controllerHover ?? hover ?? { x: 0, y: 0 };
      if (state.towerAtPos(pos)) audio.ui("select");
      state.tryPlaceOrSelect(pos);
      setControllerActive(true);
      setControllerHover(pos);
    }

    updatePressedState();
  });

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const offset = isTouchEvent(e) && selectedKind ? TOUCH_PLACEMENT_OFFSET_PX : 0;
    const pos = eventPoint(e, offset);
    setControllerActive(false);
    setHover(pos);
    if (offset) {
      setTouchAnchor(eventPoint(e, 0));
      lastTouchPlacementRef.current = pos;
      lastTouchPlacementAtRef.current = Date.now();
    } else {
      setTouchAnchor(null);
      lastTouchPlacementRef.current = null;
      lastTouchPlacementAtRef.current = 0;
    }
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    onPointerMove(e);
  };

  const onPointerOut = () => {
    if (!controllerActive) {
      setHover(null);
      setTouchAnchor(null);
      lastTouchPlacementRef.current = null;
      lastTouchPlacementAtRef.current = 0;
    }
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const hasFreshTouchPlacement =
      lastTouchPlacementRef.current !== null && Date.now() - lastTouchPlacementAtRef.current < 900;
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
                side={THREE.DoubleSide}
              />
            </mesh>
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
