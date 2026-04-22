import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import { useGame } from "../store";
import { TREE_REMOVE_COST } from "../sim/world";
import { BIOME_TREE_URLS, BIOME_STYLE } from "../biomes";

const StaticModel = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} />;
};

const obstacleLabel = (url: string): string => {
  const file = url.split("/").pop() ?? "";
  if (/^Tree/i.test(file)) return "Tree";
  if (/^Rock/i.test(file)) return "Rock";
  if (/^Bush/i.test(file)) return "Bush";
  if (/^Grass/i.test(file)) return "Grass";
  return "Obstacle";
};

export const TreePanel = () => {
  const selectedTreeId = useGame(s => s.selectedTreeId);
  const trees = useGame(s => s.world.trees);
  const biome = useGame(s => s.world.biome);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);

  if (selectedTreeId === null || status !== "running") return null;
  const tree = trees.find(t => t.id === selectedTreeId);
  if (!tree) return null;

  const url = BIOME_TREE_URLS[biome][tree.variant];
  const label = obstacleLabel(url);
  const canAfford = gold >= TREE_REMOVE_COST;
  const style = BIOME_STYLE[biome];

  return (
    <div className="tree-panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-name">Clear {label}</div>
          <div className="panel-stats">
            Remove this {label.toLowerCase()} to free up buildable ground.
          </div>
        </div>
        <button
          className="btn-close"
          onClick={() => useGame.getState().clearSelectedTree()}
          aria-label="close"
        >×</button>
      </div>

      <div className="tree-preview" style={{ background: style.groundColor }}>
        <Canvas
          camera={{ position: [3.2, 1.6, 0], fov: 26 }}
          dpr={[1, 2]}
          frameloop="demand"
          gl={{ antialias: true, alpha: true }}
          onCreated={({ camera }) => camera.lookAt(0, 0.7, 0)}
        >
          <color attach="background" args={[style.groundColor]} />
          <ambientLight intensity={0.7} color={style.hemiTop} />
          <directionalLight position={[4, 6, 3]} intensity={1.4} color="#fff4dc" />
          <hemisphereLight args={[style.hemiTop, style.hemiBottom, 0.7]} />
          <Center>
            <StaticModel url={url} />
          </Center>
        </Canvas>
      </div>

      <div className="tree-cost-row">
        <span className="tree-cost-label">Clear cost</span>
        <span className={`tree-cost-value ${canAfford ? "" : "unaffordable"}`}>
          {TREE_REMOVE_COST}g
        </span>
      </div>

      <div className="tree-actions">
        <button
          className="btn"
          disabled={!canAfford}
          onClick={() => useGame.getState().confirmRemoveTree()}
        >
          Clear · {TREE_REMOVE_COST}g
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => useGame.getState().clearSelectedTree()}
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
};
