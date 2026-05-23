import { baseDps } from "../sim/base";
import {
  BASE_STAT_LABEL,
  BASE_UPGRADES,
  type BaseStatDelta,
  type BaseUpgrade,
  formatBaseStat,
  nextBaseUpgrade,
  previewBaseUpgrade,
} from "../sim/upgrades";
import { useGame } from "../store";
import { fmtCompact } from "./format";
import { RightOverlay } from "./RightOverlay";

export const BasePanel = () => {
  const selectedBase = useGame((s) => s.ui.selectedBase);
  useGame((s) => s.ui.towerVersion);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);

  if (!selectedBase || status !== "running") return null;
  const state = useGame.getState();
  const base = state.world.base;
  const hqCount = state.world.paths.length;

  return (
    <RightOverlay className="tower-panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-name">
            HQ Laser
            <span
              className="dmg-tag"
              style={{ color: "#ff8a5a", borderColor: "#ff8a5a" }}
              title="Last-ditch defensive laser firing from every HQ"
            >
              KINETIC
            </span>
          </div>
          <div className="panel-stats">
            DMG {base.damage.toFixed(1)} · RATE {base.fireRate.toFixed(2)}/s · RNG{" "}
            {base.range.toFixed(1)} · DPS {baseDps(base, hqCount).toFixed(1)}
            {hqCount > 1 && ` (×${hqCount} HQ)`} · KILLS {base.kills} · DEALT{" "}
            {fmtCompact(base.damageDealt)}
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => state.selectBase(false)}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <div className="text-[11px] leading-snug text-fg-muted mb-3 px-2 py-2 rounded-[5px] border border-border-faint bg-surface-faint">
        Short-range gate defense. Fires a focused laser at the enemy closest to leaking, from{" "}
        {hqCount > 1 ? `each of the ${hqCount} HQs` : "the HQ"}. Persists across the run.
      </div>

      <div className="branches">
        <BaseBranchView branchId="a" gold={gold} />
        <BaseBranchView branchId="b" gold={gold} />
      </div>
    </RightOverlay>
  );
};

const BaseBranchView = ({ branchId, gold }: { branchId: "a" | "b"; gold: number }) => {
  const state = useGame.getState();
  const base = state.world.base;
  const branch = BASE_UPGRADES[branchId];
  const tier = base.upgrades[branchId];
  const next: BaseUpgrade | null = nextBaseUpgrade(base, branchId);
  const upgrade = useGame((s) => s.upgradeBase);
  const deltas: BaseStatDelta[] = next ? previewBaseUpgrade(base, next) : [];

  return (
    <div className="branch">
      <div className="branch-label">{branch.label}</div>
      <div className="tiers">
        {branch.tiers.map((t, i) => (
          <div
            key={t.name}
            className={`tier ${i < tier ? "owned" : i === tier ? "next" : "locked"}`}
          >
            <div className="tier-name">{t.name}</div>
            <div className="tier-desc">{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="branch-upgrade-slot">
        {next && deltas.length > 0 && (
          <div className="tier-preview">
            {deltas.map((d) => (
              <div key={d.key} className="tier-preview-row">
                <span className="tier-preview-label">{BASE_STAT_LABEL[d.key]}</span>
                <span className="tier-preview-from">{formatBaseStat(d.key, d.from)}</span>
                <span className="tier-preview-arrow">→</span>
                <span className="tier-preview-to better">{formatBaseStat(d.key, d.to)}</span>
              </div>
            ))}
          </div>
        )}
        {next ? (
          <button
            type="button"
            className="btn-upgrade"
            disabled={gold < next.cost}
            onClick={() => upgrade(branchId)}
          >
            Upgrade · {next.cost}g
          </button>
        ) : (
          <div className="branch-max">Maxed Out</div>
        )}
      </div>
    </div>
  );
};
