import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { useGame } from "./store";
import { PlayScene } from "./render/Scene";
import { WorldMapScene } from "./render/WorldMap";
import { HUD } from "./ui/HUD";
import { WorldMapUI } from "./ui/WorldMapUI";
import { ResultsScreen } from "./ui/ResultsScreen";
import { Compendium } from "./ui/Compendium";

const SceneRoot = () => {
  const screen = useGame(s => s.screen);
  return screen === "worldMap" ? <WorldMapScene /> : <PlayScene />;
};

export const App = () => {
  const screen = useGame(s => s.screen);
  const compendiumOpen = useGame(s => s.compendiumOpen);

  return (
    <>
      {!compendiumOpen && (
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

      {screen === "worldMap" && <WorldMapUI />}
      {screen !== "worldMap" && <HUD />}
      {screen === "results" && <ResultsScreen />}
      {compendiumOpen && <Compendium />}
    </>
  );
};
