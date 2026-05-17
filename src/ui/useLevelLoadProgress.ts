// Bridges THREE.DefaultLoadingManager → the Zustand store so the
// LevelLoadOverlay can display GLB/texture download progress without
// each loader having to wire its own callbacks. drei's useGLTF and
// drei's Environment both go through the default manager.
//
// The hook is mounted exactly once (from App.tsx). It overwrites the
// manager's onStart/onProgress/onLoad/onError handlers, so anything
// else relying on those would conflict — currently nothing does.
import { useEffect } from "react";
import { DefaultLoadingManager } from "three";
import { useGame } from "../store";

export const useLevelLoadProgress = (): void => {
  useEffect(() => {
    const set = useGame.getState().setLevelLoadProgress;

    const onStart = (_url: string, itemsLoaded: number, itemsTotal: number) => {
      set({ loaded: itemsLoaded, total: itemsTotal });
    };
    const onProgress = (_url: string, itemsLoaded: number, itemsTotal: number) => {
      set({ loaded: itemsLoaded, total: itemsTotal });
    };
    const onLoad = () => {
      set(null);
    };
    const onError = () => {
      set(null);
    };

    const prevStart = DefaultLoadingManager.onStart;
    const prevProgress = DefaultLoadingManager.onProgress;
    const prevLoad = DefaultLoadingManager.onLoad;
    const prevError = DefaultLoadingManager.onError;

    DefaultLoadingManager.onStart = onStart;
    DefaultLoadingManager.onProgress = onProgress;
    DefaultLoadingManager.onLoad = onLoad;
    DefaultLoadingManager.onError = onError;

    return () => {
      DefaultLoadingManager.onStart = prevStart;
      DefaultLoadingManager.onProgress = prevProgress;
      DefaultLoadingManager.onLoad = prevLoad;
      DefaultLoadingManager.onError = prevError;
    };
  }, []);
};
