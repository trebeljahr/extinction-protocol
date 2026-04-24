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

export const App = () => {
  const screen = useGame((s) => s.screen);
  const compendiumOpen = useGame((s) => s.compendiumOpen);
  const achievementsOpen = useGame((s) => s.achievementsOpen);
  const modalOpen = compendiumOpen || achievementsOpen;

  return (
    <>
      {!modalOpen && (
        <Canvas shadows dpr={[1, 2]}>
          <SceneRoot />
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.28}
              luminanceThreshold={0.82}
              luminanceSmoothing={0.18}
              mipmapBlur
              kernelSize={KernelSize.MEDIUM}
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
