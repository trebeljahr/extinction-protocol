import { useEffect, useRef } from "react";
import { setInputMode } from "../ui/useInputMode";

export const GAMEPAD_BUTTONS = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

export const GAMEPAD_AXES = {
  leftX: 0,
  leftY: 1,
  rightX: 2,
  rightY: 3,
} as const;

export const GAMEPAD_STICK_DEADZONE = 0.18;
export const GAMEPAD_MENU_DEADZONE = 0.55;

export type GamepadButtonName = keyof typeof GAMEPAD_BUTTONS;
export type GamepadAxisName = keyof typeof GAMEPAD_AXES;
export type GamepadButtonInput = GamepadButtonName | number;
export type GamepadAxisInput = GamepadAxisName | number;

export type GamepadInputFrame = {
  gamepad: Gamepad | null;
  timestamp: number;
  delta: number;
  buttonDown: (button: GamepadButtonInput) => boolean;
  buttonPressed: (button: GamepadButtonInput) => boolean;
  axis: (axis: GamepadAxisInput) => number;
};

type GamepadListener = (frame: GamepadInputFrame) => void;

const buttonIndex = (button: GamepadButtonInput) =>
  typeof button === "number" ? button : GAMEPAD_BUTTONS[button];

const axisIndex = (axis: GamepadAxisInput) =>
  typeof axis === "number" ? axis : GAMEPAD_AXES[axis];

const firstConnectedGamepad = (): Gamepad | null => {
  if (typeof navigator === "undefined") return null;
  const pads = navigator.getGamepads?.();
  return Array.from(pads ?? []).find((pad): pad is Gamepad => Boolean(pad?.connected)) ?? null;
};

class GamepadInputManager {
  private listeners = new Set<GamepadListener>();
  private frameId = 0;
  private lastTimestamp = 0;
  private previousButtons: boolean[] = [];

  subscribe(listener: GamepadListener) {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start() {
    if (this.frameId || typeof requestAnimationFrame !== "function") return;
    this.lastTimestamp = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.previousButtons = [];
  }

  private tick = (timestamp: number) => {
    const delta = Math.min(0.1, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;

    const gamepad = firstConnectedGamepad();
    const buttons = gamepad?.buttons.map((button) => button.pressed) ?? [];
    const axes = gamepad?.axes.slice() ?? [];
    const previous = this.previousButtons;
    if (
      gamepad &&
      (buttons.some(Boolean) || axes.some((axis) => Math.abs(axis) > GAMEPAD_STICK_DEADZONE))
    ) {
      setInputMode("gamepad");
    }

    const frame: GamepadInputFrame = {
      gamepad,
      timestamp,
      delta,
      buttonDown: (button) => Boolean(buttons[buttonIndex(button)]),
      buttonPressed: (button) => {
        const index = buttonIndex(button);
        return Boolean(buttons[index]) && !previous[index];
      },
      axis: (axis) => axes[axisIndex(axis)] ?? 0,
    };

    for (const listener of this.listeners) listener(frame);

    this.previousButtons = buttons;
    this.frameId = requestAnimationFrame(this.tick);
  };
}

export const gamepadInput = new GamepadInputManager();

export const useGamepadInput = (handler: GamepadListener, enabled = true) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    return gamepadInput.subscribe((frame) => handlerRef.current(frame));
  }, [enabled]);
};

export const snapGamepadAxis = (value: number, deadzone = GAMEPAD_STICK_DEADZONE) =>
  Math.abs(value) > deadzone ? value : 0;

// Remaps post-deadzone magnitude to a full 0..1 range so cursor speed
// ramps smoothly from rest instead of jumping to deadzone-magnitude on
// first deflection. Returns sign-preserved scaled value, or 0 inside
// the deadzone.
export const scaleGamepadAxis = (value: number, deadzone = GAMEPAD_STICK_DEADZONE) => {
  const abs = Math.abs(value);
  if (abs <= deadzone) return 0;
  return Math.sign(value) * ((abs - deadzone) / (1 - deadzone));
};

export const snapGamepadDirection = (value: number, deadzone = GAMEPAD_MENU_DEADZONE) => {
  if (value > deadzone) return 1;
  if (value < -deadzone) return -1;
  return 0;
};
