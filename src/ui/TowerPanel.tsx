import { useEffect, useState } from "react";
import { effectiveFireRate } from "../sim/towers";
import type { EnemyKind, TargetingMode, Tower } from "../sim/types";
import {
  formatStat,
  nextUpgrade,
  previewUpgrade,
  STAT_LABEL,
  sellRefund,
  UPGRADES,
} from "../sim/upgrades";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  ENEMY_LABEL,
  ENEMY_RESIST,
  TOWER_DAMAGE_TYPE,
  TOWER_LABEL,
} from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { HiveDronePanel } from "./HiveDronePanel";
import { TowerPreview } from "./TowerPreview";

// Compact number formatter — keeps stat lines short once damage totals
// climb into the tens of thousands. 1234 → "1.2k", 1_500_000 → "1.5M".
const fmtCompact = (n: number): string => {
  if (n < 1000) return Math.round(n).toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
};

const ENEMY_ORDER: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
  "boss",
];

const TARGETING_MODES: {
  mode: TargetingMode;
  label: string;
  title: string;
}[] = [
  { mode: "tower", label: "Near", title: "Closest to tower" },
  { mode: "start", label: "Start", title: "Closest to path start" },
  { mode: "end", label: "End", title: "Closest to path end" },
  { mode: "strongest", label: "Strong", title: "Highest max HP in range" },
  {
    mode: "weakest",
    label: "Weak",
    title: "Lowest current HP — finish off damaged enemies (ignores shielded)",
  },
];

export const TowerPanel = () => {
  const selectedId = useGame((s) => s.ui.selectedTowerId);
  useGame((s) => s.ui.towerVersion);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);

  if (selectedId === null || status !== "running") return null;
  const tower = useGame.getState().world.towerById.get(selectedId);
  if (!tower) return null;

  // Hive is pure support — its damage / damage-type / resist columns
  // are meaningless. Branch above and skip the offensive widgets so the
  // panel reads as "what does this tower do for the others."
  if (tower.kind === "hive") {
    return (
      <div className="tower-panel">
        <div className="panel-header">
          <TowerPreview kind={tower.kind} />
          <div className="panel-title">
            <div className="panel-name">
              {TOWER_LABEL[tower.kind]}
              <span
                className="dmg-tag"
                style={{ color: "#bbffc8", borderColor: "#bbffc8" }}
                title="Support tower — boosts other towers' fire rate"
              >
                SUPPORT
              </span>
            </div>
            <div className="panel-stats">
              DRONES {tower.droneCount} · BUFF +{Math.round(tower.serviceBuff * 100)}%/drone
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => useGame.getState().selectTower(null)}
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="text-[11px] leading-snug text-fg-muted mb-3 px-2 py-2 rounded-[5px] border border-border-faint bg-surface-faint">
          Each drone adds{" "}
          <span style={{ color: "#bbffc8" }}>
            +{Math.round(tower.serviceBuff * 100)}% fire rate
          </span>{" "}
          to its assigned tower. Up to 6 drones can stack on one tower. Click "Pick" on a slot, then
          click a tower on the map to assign.
        </div>

        <HiveDronePanel hive={tower} />

        <div className="branches">
          <BranchView tower={tower} branchId="a" gold={gold} />
          <BranchView tower={tower} branchId="b" gold={gold} />
        </div>

        <SellFooter tower={tower} />
      </div>
    );
  }

  const damageType = TOWER_DAMAGE_TYPE[tower.kind];

  return (
    <div className="tower-panel">
      <div className="panel-header">
        <TowerPreview kind={tower.kind} />
        <div className="panel-title">
          <div className="panel-name">
            {TOWER_LABEL[tower.kind]}
            <span
              className="dmg-tag"
              style={{
                color: DAMAGE_TYPE_COLOR[damageType],
                borderColor: DAMAGE_TYPE_COLOR[damageType],
              }}
            >
              <DamageIcon type={damageType} size={12} title={DAMAGE_TYPE_LABEL[damageType]} />
              {DAMAGE_TYPE_LABEL[damageType]}
            </span>
          </div>
          <div className="panel-stats">
            DMG {tower.damage.toFixed(1)} · RATE {tower.fireRate.toFixed(2)}/s · RNG{" "}
            {tower.range.toFixed(1)} · DPS {(tower.damage * effectiveFireRate(tower)).toFixed(1)} ·
            KILLS {tower.kills} · DEALT {fmtCompact(tower.damageDealt)}
            {tower.splashRadius > 0 && ` · SPL ${tower.splashRadius.toFixed(1)}`}
            {tower.chainCount > 0 && ` · CHN ${tower.chainCount}`}
            {tower.slowFactor < 1 && ` · SLOW ${(1 - tower.slowFactor).toFixed(2)}`}
            {tower.serviceFireRateBonus > 0 && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: "#bbffc8" }}>
                  SUPPORT +{Math.round(tower.serviceFireRateBonus * 100)}%
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => useGame.getState().selectTower(null)}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <div className="resist-row">
        {ENEMY_ORDER.map((k) => {
          const mul = ENEMY_RESIST[k][damageType];
          const pct = Math.round((mul - 1) * 100);
          const cls = pct > 0 ? "good" : pct < 0 ? "bad" : "neutral";
          return (
            <div
              key={k}
              className={`resist-chip ${cls}`}
              title={`vs ${ENEMY_LABEL[k]}: ${mul.toFixed(2)}×`}
            >
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
                type="button"
                key={mode}
                className={`targeting-btn ${tower.targetingMode === mode ? "active" : ""}`}
                onClick={() => useGame.getState().setTargetingMode(mode)}
                title={title}
              >
                {label}
              </button>
            ))}
            {tower.kind === "mortar" && (
              <button
                type="button"
                className={`targeting-btn ${tower.targetingMode === "spot" ? "active" : ""}`}
                onClick={() => useGame.getState().setTargetingMode("spot")}
                title="Fire only at a fixed map spot — click the map to set it"
              >
                Spot
              </button>
            )}
          </div>
        </div>
      )}
      {tower.kind === "mortar" && tower.targetingMode === "spot" && !tower.targetSpot && (
        <div className="targeting-hint">
          Click a spot on the map within range to set the aim point.
        </div>
      )}

      <div className="branches">
        <BranchView tower={tower} branchId="a" gold={gold} />
        <BranchView tower={tower} branchId="b" gold={gold} />
      </div>

      <SellFooter tower={tower} />
    </div>
  );
};

const SellFooter = ({ tower }: { tower: Tower }) => {
  const [confirming, setConfirming] = useState(false);
  // Reset the confirm state whenever the selected tower changes so
  // switching towers never leaves a stale "Confirm Sell" from a
  // different tower.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tower.id is the intended trigger; other tower fields can change without needing reset
  useEffect(() => {
    setConfirming(false);
  }, [tower.id]);
  const refund = sellRefund(tower);

  if (confirming) {
    return (
      <div className="panel-footer panel-footer-confirm">
        <button type="button" className="btn-sell-cancel" onClick={() => setConfirming(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-sell btn-sell-confirm"
          onClick={() => {
            setConfirming(false);
            useGame.getState().sellSelected();
          }}
        >
          Confirm Sell · {refund}g
        </button>
      </div>
    );
  }
  return (
    <div className="panel-footer">
      <button type="button" className="btn-sell" onClick={() => setConfirming(true)}>
        Sell · {refund}g
      </button>
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
  const upgrade = useGame((s) => s.upgradeSelected);

  const deltas = next ? previewUpgrade(tower, next) : [];

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
      {/*
        Reserve a fixed vertical slot so the Sell button in panel-footer
        doesn't jump up when a branch maxes out mid-click — rapid clicking
        the upgrade button right at the last tier used to land the next
        click on Sell.
      */}
      <div className="branch-upgrade-slot">
        {next && deltas.length > 0 && (
          <div className="tier-preview">
            {deltas.map((d) => {
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
