import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { PlayScene } from "./render/Scene";
import { WorldMapScene } from "./render/WorldMap";
import { useGame } from "./store";
import { AchievementToast } from "./ui/AchievementToast";
import { AchievementsPanel } from "./ui/AchievementsPanel";
import { Compendium } from "./ui/Compendium";
import { HUD } from "./ui/HUD";
import { NewEnemyAlert } from "./ui/NewEnemyAlert";
import { ResultsScreen } from "./ui/ResultsScreen";
import { WorldMapUI } from "./ui/WorldMapUI";

const SceneRoot = () => {
  const screen = useGame((s) => s.screen);
  return screen === "worldMap" ? <WorldMapScene /> : <PlayScene />;
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
  const modalOpen = compendiumOpen || achievementsOpen;

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
      {compendiumOpen && <Compendium />}
      {achievementsOpen && <AchievementsPanel />}
      {screen === "playing" && !modalOpen && <NewEnemyAlert />}
      <AchievementToast />
    </>
  );
};
