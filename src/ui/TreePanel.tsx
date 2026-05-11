import { Bounds, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { BIOME_LAYERS, BIOME_STYLE, BIOME_TREE_URLS } from "../biomes";
import { ROCK_REMOVE_COST, TREE_REMOVE_COST } from "../sim/world";
import { useGame } from "../store";

const StaticModel = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} />;
};

const obstacleLabel = (url: string): string => {
  const file = url.split("/").pop() ?? "";
  if (/^Tree|DeadTree/i.test(file)) return "Tree";
  if (/^Rock/i.test(file)) return "Rock";
  if (/^Bush/i.test(file)) return "Bush";
  if (/^Grass/i.test(file)) return "Grass";
  if (/^Mushroom/i.test(file)) return "Mushroom";
  if (/^Skull/i.test(file)) return "Skull";
  if (/^Crystal/i.test(file)) return "Crystal";
  if (/^Plant/i.test(file)) return "Plant";
  if (/^hangar_|structure_/i.test(file)) return "Structure";
  return "Obstacle";
};

type Selection =
  | { kind: "tree"; url: string; cost: number; clear: () => void; confirm: () => void }
  | { kind: "rock"; url: string; cost: number; clear: () => void; confirm: () => void };

export const TreePanel = () => {
  const selectedTreeId = useGame((s) => s.selectedTreeId);
  const selectedRockId = useGame((s) => s.selectedRockId);
  const trees = useGame((s) => s.world.trees);
  const rocks = useGame((s) => s.world.rocks);
  const biome = useGame((s) => s.world.biome);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);

  if (status !== "running") return null;

  let selection: Selection | null = null;
  if (selectedTreeId !== null) {
    const tree = trees.find((t) => t.id === selectedTreeId);
    if (tree) {
      selection = {
        kind: "tree",
        url: BIOME_TREE_URLS[biome][tree.variant],
        cost: TREE_REMOVE_COST,
        clear: () => useGame.getState().clearSelectedTree(),
        confirm: () => useGame.getState().confirmRemoveTree(),
      };
    }
  } else if (selectedRockId !== null) {
    const rock = rocks.find((r) => r.id === selectedRockId);
    if (rock) {
      const layer = BIOME_LAYERS[biome][rock.layerIndex];
      const url = layer?.urls[rock.variant];
      if (url) {
        selection = {
          kind: "rock",
          url,
          cost: ROCK_REMOVE_COST,
          clear: () => useGame.getState().clearSelectedRock(),
          confirm: () => useGame.getState().confirmRemoveRock(),
        };
      }
    }
  }

  if (!selection) return null;

  const label = obstacleLabel(selection.url);
  const canAfford = gold >= selection.cost;
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
          type="button"
          className="btn-close"
          data-ui-sound="close"
          onClick={selection.clear}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <div
        className="w-full h-[180px] mb-3 rounded-lg overflow-hidden border border-[rgba(120,160,120,0.18)]"
        style={{ background: style.groundColor }}
      >
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
          {/* `key` remounts Bounds so it re-fits when a different obstacle is picked — Bounds doesn't observe child changes. */}
          <Suspense fallback={null}>
            <Bounds key={selection.url} fit clip observe margin={1.15}>
              <StaticModel url={selection.url} />
            </Bounds>
          </Suspense>
        </Canvas>
      </div>

      <div className="flex justify-between items-baseline mb-2.5 px-2.5 py-1.5 rounded-md bg-surface-inset border border-border-faint">
        <span className="text-[11px] font-bold tracking-wide text-fg-muted uppercase">
          Clear cost
        </span>
        <span
          className={`text-lg font-bold tabular-nums ${canAfford ? "text-gold" : "text-[#ff7a8a]"}`}
        >
          {selection.cost}g
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" disabled={!canAfford} onClick={selection.confirm}>
          Clear · {selection.cost}g
        </button>
        <button type="button" className="btn btn-secondary" onClick={selection.clear}>
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
};
