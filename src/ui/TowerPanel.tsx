import { useGame } from "../store";
import {
  TOWER_LABEL,
  TOWER_DAMAGE_TYPE,
  DAMAGE_TYPE_LABEL,
  DAMAGE_TYPE_COLOR,
  ENEMY_RESIST,
  ENEMY_LABEL,
} from "../sim/world";
import {
  UPGRADES,
  nextUpgrade,
  sellRefund,
  previewUpgrade,
  formatStat,
  STAT_LABEL,
} from "../sim/upgrades";
import type { Tower, EnemyKind, TargetingMode } from "../sim/types";

const ENEMY_ORDER: EnemyKind[] = ["raptor", "swarm", "para", "allosaur", "stego", "armored", "titan"];

const TARGETING_MODES: { mode: TargetingMode; label: string; title: string }[] = [
  { mode: "tower", label: "Near", title: "Closest to tower" },
  { mode: "start", label: "Start", title: "Closest to path start" },
  { mode: "end", label: "End", title: "Closest to path end" },
  { mode: "strongest", label: "Strong", title: "Highest max HP in range" },
];

export const TowerPanel = () => {
  const selectedId = useGame(s => s.ui.selectedTowerId);
  useGame(s => s.ui.towerVersion);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);

  if (selectedId === null || status !== "running") return null;
  const tower = useGame.getState().world.towers.find(t => t.id === selectedId);
  if (!tower) return null;

  const damageType = TOWER_DAMAGE_TYPE[tower.kind];

  return (
    <div className="tower-panel">
      <div className="panel-header">
        <div className={`tower-swatch kind-${tower.kind}`} />
        <div className="panel-title">
          <div className="panel-name">
            {TOWER_LABEL[tower.kind]}
            <span
              className="dmg-tag"
              style={{ color: DAMAGE_TYPE_COLOR[damageType], borderColor: DAMAGE_TYPE_COLOR[damageType] }}
            >
              {DAMAGE_TYPE_LABEL[damageType]}
            </span>
          </div>
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

      <div className="resist-row">
        {ENEMY_ORDER.map(k => {
          const mul = ENEMY_RESIST[k][damageType];
          const pct = Math.round((mul - 1) * 100);
          const cls = pct > 0 ? "good" : pct < 0 ? "bad" : "neutral";
          return (
            <div key={k} className={`resist-chip ${cls}`} title={`vs ${ENEMY_LABEL[k]}: ${mul.toFixed(2)}×`}>
              <span className="resist-name">{ENEMY_LABEL[k]}</span>
              <span className="resist-val">{pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "·"}</span>
            </div>
          );
        })}
      </div>

      {tower.kind !== "cryo" && (
        <div className="targeting-row">
          <div className="targeting-label">Target</div>
          <div className="targeting-buttons">
            {TARGETING_MODES.map(({ mode, label, title }) => (
              <button
                key={mode}
                className={`targeting-btn ${tower.targetingMode === mode ? "active" : ""}`}
                onClick={() => useGame.getState().setTargetingMode(mode)}
                title={title}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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

  const deltas = next ? previewUpgrade(tower, next) : [];

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
      {next && deltas.length > 0 && (
        <div className="tier-preview">
          {deltas.map(d => {
            const better =
              // For slowFactor lower is better, everything else higher.
              d.key === "slowFactor" ? d.to < d.from : d.to > d.from;
            return (
              <div key={d.key} className="tier-preview-row">
                <span className="tier-preview-label">{STAT_LABEL[d.key]}</span>
                <span className="tier-preview-from">{formatStat(d.key, d.from)}</span>
                <span className="tier-preview-arrow">→</span>
                <span className={`tier-preview-to ${better ? "better" : "worse"}`}>
                  {formatStat(d.key, d.to)}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
