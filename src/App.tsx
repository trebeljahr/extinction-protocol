import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { lazy, Suspense, useEffect } from "react";
import { PlayScene } from "./render/Scene";
import { useGame } from "./store";
import { AchievementToast } from "./ui/AchievementToast";
import { HUD } from "./ui/HUD";
import { NewEnemyAlert } from "./ui/NewEnemyAlert";
import { ResultsScreen } from "./ui/ResultsScreen";
import { WorldMapUI } from "./ui/WorldMapUI";

// Heavy panels and the world-map scene only load when the user actually
// opens them. WorldMapScene pulls all biome models; Compendium and
// AchievementsPanel each carry their own art and copy. Splitting them
// drops the initial JS payload by hundreds of KB.
const WorldMapScene = lazy(() =>
  import("./render/WorldMap").then((m) => ({ default: m.WorldMapScene })),
);
const Compendium = lazy(() => import("./ui/Compendium").then((m) => ({ default: m.Compendium })));
const AchievementsPanel = lazy(() =>
  import("./ui/AchievementsPanel").then((m) => ({ default: m.AchievementsPanel })),
);

const SceneRoot = () => {
  const screen = useGame((s) => s.screen);
  // Suspense fallback is null — Canvas already renders nothing on first
  // frame anyway, and the world-map only shows up post-load.
  return screen === "worldMap" ? (
    <Suspense fallback={null}>
      <WorldMapScene />
    </Suspense>
  ) : (
    <PlayScene />
  );
};

// Lightweight device tier check used to scale bloom kernel and DPR cap.
// `low` = mobile-ish (<=4 logical cores or coarse pointer / mobile UA);
// other devices keep the higher-quality MEDIUM kernel.
const isLowEndDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4) return true;
  if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
};

const lowEnd = isLowEndDevice();
const bloomKernel = lowEnd ? KernelSize.SMALL : KernelSize.MEDIUM;
const dprCap: [number, number] = lowEnd ? [1, 1.5] : [1, 2];

export const App = () => {
  const screen = useGame((s) => s.screen);
  const compendiumOpen = useGame((s) => s.compendiumOpen);
  const achievementsOpen = useGame((s) => s.achievementsOpen);
  const selectedKind = useGame((s) => s.selectedKind);
  const modalOpen = compendiumOpen || achievementsOpen;

  // Drive the cursor from gameplay state. Crosshair on the canvas
  // while a tower kind is selected, default everywhere else. Buttons
  // keep `cursor: pointer` because their rules win on specificity.
  useEffect(() => {
    const cls = "is-placing";
    if (selectedKind !== null) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [selectedKind]);

  return (
    <>
      {!modalOpen && (
        <Canvas shadows dpr={dprCap}>
          <SceneRoot />
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.28}
              luminanceThreshold={0.82}
              luminanceSmoothing={0.18}
              mipmapBlur
              kernelSize={bloomKernel}
            />
          </EffectComposer>
        </Canvas>
      )}

      {screen === "worldMap" && !modalOpen && <WorldMapUI />}
      {screen !== "worldMap" && !modalOpen && <HUD />}
      {screen === "results" && !modalOpen && <ResultsScreen />}
      {compendiumOpen && (
        <Suspense fallback={null}>
          <Compendium />
        </Suspense>
      )}
      {achievementsOpen && (
        <Suspense fallback={null}>
          <AchievementsPanel />
        </Suspense>
      )}
      {screen === "playing" && !modalOpen && <NewEnemyAlert />}
      <AchievementToast />
    </>
  );
};
