import { Canvas } from "@react-three/fiber";
import { useGame } from "./store";
import { PlayScene } from "./render/Scene";
import { WorldMapScene } from "./render/WorldMap";
import { HUD } from "./ui/HUD";
import { WorldMapUI } from "./ui/WorldMapUI";
import { ResultsScreen } from "./ui/ResultsScreen";

const SceneRoot = () => {
  const screen = useGame(s => s.screen);
  return screen === "worldMap" ? <WorldMapScene /> : <PlayScene />;
};

export const App = () => {
  const screen = useGame(s => s.screen);

  return (
    <>
      <Canvas shadows dpr={[1, 2]}>
        <SceneRoot />
      </Canvas>

      {screen === "worldMap" && <WorldMapUI />}
      {screen !== "worldMap" && <HUD />}
      {screen === "results" && <ResultsScreen />}
    </>
  );
};
