import { useEffect, useSyncExternalStore } from "react";

export type InputMode = "keyboard" | "pointer" | "gamepad";

type InputModeState = {
  mode: InputMode;
  touchPrimary: boolean;
};

const GAMEPAD_KEY_EVENT = "__extinctionProtocolGamepadKey";
const subscribers = new Set<() => void>();
const serverState: InputModeState = { mode: "keyboard", touchPrimary: false };

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const matches = (query: string): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches;

const detectsTouchPrimary = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const mobileUa = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return (
    matches("(pointer: coarse)") ||
    (touchPoints > 0 && (matches("(hover: none)") || mobileUa)) ||
    (touchPoints > 0 && typeof window.matchMedia !== "function" && mobileUa)
  );
};

const initialTouchPrimary = isBrowser() ? detectsTouchPrimary() : false;
let state: InputModeState = isBrowser()
  ? {
      mode: initialTouchPrimary ? "pointer" : "keyboard",
      touchPrimary: initialTouchPrimary,
    }
  : serverState;

const publish = (next: InputModeState) => {
  if (next.mode === state.mode && next.touchPrimary === state.touchPrimary) return;
  state = next;
  for (const subscriber of subscribers) subscriber();
};

export const setInputMode = (mode: InputMode) => {
  publish({ ...state, mode });
};

const refreshTouchPrimary = () => {
  publish({ ...state, touchPrimary: detectsTouchPrimary() });
};

const subscribe = (subscriber: () => void) => {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
};

const getSnapshot = () => state;
const getServerSnapshot = () => serverState;

export const useInputMode = (): InputModeState =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const useKeyboardHintsVisible = (): boolean => {
  const input = useInputMode();
  return input.mode === "keyboard" && !input.touchPrimary;
};

export const dispatchGamepadKeyboard = (key: string, code = key) => {
  setInputMode("gamepad");
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true });
  Object.defineProperty(event, GAMEPAD_KEY_EVENT, { value: true });
  window.dispatchEvent(event);
};

export const useInputModeSignal = () => {
  const input = useInputMode();

  useEffect(() => {
    if (!isBrowser()) return;
    refreshTouchPrimary();

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event as KeyboardEvent & Record<typeof GAMEPAD_KEY_EVENT, true>)[GAMEPAD_KEY_EVENT]) {
        return;
      }
      setInputMode("keyboard");
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") setInputMode("pointer");
    };
    const onTouchStart = () => setInputMode("pointer");
    const onGamepadInput = () => setInputMode("gamepad");
    const onGamepadDisconnected = () => {
      setInputMode(detectsTouchPrimary() ? "pointer" : "keyboard");
    };
    const mediaQueries =
      typeof window.matchMedia === "function"
        ? ["(pointer: coarse)", "(hover: none)", "(any-pointer: coarse)"].map((query) =>
            window.matchMedia(query),
          )
        : [];

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    window.addEventListener("gamepadconnected", onGamepadInput);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
    for (const query of mediaQueries) {
      if (query.addEventListener) query.addEventListener("change", refreshTouchPrimary);
      else query.addListener(refreshTouchPrimary);
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("touchstart", onTouchStart, { capture: true });
      window.removeEventListener("gamepadconnected", onGamepadInput);
      window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
      for (const query of mediaQueries) {
        if (query.removeEventListener) query.removeEventListener("change", refreshTouchPrimary);
        else query.removeListener(refreshTouchPrimary);
      }
    };
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    document.body.dataset.inputMode = input.mode;
    document.body.classList.toggle("is-touch-primary", input.touchPrimary);
    return () => {
      document.body.removeAttribute("data-input-mode");
      document.body.classList.remove("is-touch-primary");
    };
  }, [input.mode, input.touchPrimary]);
};
