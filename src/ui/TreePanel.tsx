import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../store";
import { TREE_REMOVE_COST } from "../sim/world";
import { BIOME_TREE_URLS } from "../biomes";

const ModelSpinner = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6;
  });
  return (
    <group ref={ref}>
      <primitive object={cloned} />
    </group>
  );
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

      <div className="tree-preview">
        <Canvas
          camera={{ position: [2.6, 2.4, 2.8], fov: 32 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.75} />
          <hemisphereLight args={["#ffeecc", "#3a3020", 0.6]} />
          <directionalLight position={[4, 6, 3]} intensity={0.9} />
          <Center>
            <ModelSpinner url={url} />
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
