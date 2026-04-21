import { useGame } from "../store";
import { TOWER_LABEL } from "../sim/world";
import { UPGRADES, nextUpgrade, sellRefund } from "../sim/upgrades";
import type { Tower } from "../sim/types";

export const TowerPanel = () => {
  const selectedId = useGame(s => s.ui.selectedTowerId);
  useGame(s => s.ui.towerVersion);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);

  if (selectedId === null || status !== "running") return null;
  const tower = useGame.getState().world.towers.find(t => t.id === selectedId);
  if (!tower) return null;

  return (
    <div className="tower-panel">
      <div className="panel-header">
        <div className={`tower-swatch kind-${tower.kind}`} />
        <div className="panel-title">
          <div className="panel-name">{TOWER_LABEL[tower.kind]}</div>
          <div className="panel-stats">
            DMG {tower.damage.toFixed(1)} · RATE {tower.fireRate.toFixed(2)}/s · RNG {tower.range.toFixed(1)}
            {tower.splashRadius > 0 && ` · SPL ${tower.splashRadius.toFixed(1)}`}
            {tower.chainCount > 0 && ` · CHN ${tower.chainCount}`}
            {tower.slowFactor < 1 && ` · SLOW ${(1 - tower.slowFactor).toFixed(2)}`}
          </div>
        </div>
        <button
          className="btn-close"
          onClick={() => useGame.getState().selectTower(null)}
          aria-label="close"
        >×</button>
      </div>

      <div className="branches">
        <BranchView tower={tower} branchId="a" gold={gold} />
        <BranchView tower={tower} branchId="b" gold={gold} />
      </div>

      <div className="panel-footer">
        <button
          className="btn-sell"
          onClick={() => useGame.getState().sellSelected()}
        >
          Sell · {sellRefund(tower)}g
        </button>
      </div>
    </div>
  );
};

const BranchView = ({
  tower,
  branchId,
  gold,
}: {
  tower: Tower;
  branchId: "a" | "b";
  gold: number;
}) => {
  const branch = UPGRADES[tower.kind][branchId];
  const tier = tower.upgrades[branchId];
  const next = nextUpgrade(tower, branchId);
  const upgrade = useGame(s => s.upgradeSelected);

  return (
    <div className="branch">
      <div className="branch-label">{branch.label}</div>
      <div className="tiers">
        {branch.tiers.map((t, i) => (
          <div key={i} className={`tier ${i < tier ? "owned" : i === tier ? "next" : "locked"}`}>
            <div className="tier-name">{t.name}</div>
            <div className="tier-desc">{t.desc}</div>
          </div>
        ))}
      </div>
      {next ? (
        <button
          className="btn-upgrade"
          disabled={gold < next.cost}
          onClick={() => upgrade(branchId)}
        >
          Upgrade · {next.cost}g
        </button>
      ) : (
        <div className="branch-max">maxed</div>
      )}
    </div>
  );
};
