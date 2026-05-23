import { ROBOT_SPECS, robotAbilityDamageType } from "../sim/robotVariants";
import type { RobotAbilitySlot } from "../sim/types";
import { clamp01 } from "../sim/vec2";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { RightOverlay } from "./RightOverlay";
import { RobotPreview } from "./RobotPreview";
import { formatAbilityStats } from "./robotAbilityStats";
import { useKeyboardHintsVisible } from "./useInputMode";

const SLOT_KEYS: Array<{ slot: RobotAbilitySlot; key: "Q" | "W" | "E" | "R" }> = [
  { slot: 0, key: "Q" },
  { slot: 1, key: "W" },
  { slot: 2, key: "E" },
  { slot: 3, key: "R" },
];

export const RobotSelectionPanel = () => {
  const showKeyboardHints = useKeyboardHintsVisible();
  const open = useGame((s) => s.robotPanelOpen);
  const status = useGame((s) => s.ui.status);
  const variant = useGame((s) => s.ui.robotVariant);
  const label = useGame((s) => s.ui.robotLabel);
  const level = useGame((s) => s.ui.robotLevel);
  const xpInto = useGame((s) => s.ui.robotXpInto);
  const xpNeed = useGame((s) => s.ui.robotXpNeed);
  const hp = useGame((s) => s.ui.robotHp);
  const maxHp = useGame((s) => s.ui.robotMaxHp);
  const alive = useGame((s) => s.ui.robotAlive);
  const respawnRemaining = useGame((s) => s.ui.robotRespawnRemaining);
  const labels = useGame((s) => s.ui.robotAbilityLabels);
  const glyphs = useGame((s) => s.ui.robotAbilityGlyphs);
  const setRobotPanelOpen = useGame((s) => s.setRobotPanelOpen);

  if (!open || status !== "running") return null;

  const robot = useGame.getState().world.robot;
  const spec = ROBOT_SPECS[variant];
  const damageType = robot.damageType;
  const dps = robot.damage * robot.fireRate;
  const hpPct = maxHp > 0 ? clamp01(hp / maxHp) : 0;
  const xpPct = xpNeed > 0 ? clamp01(xpInto / xpNeed) : 0;

  return (
    <RightOverlay className="tower-panel robot-selection-panel">
      <div className="panel-header">
        <RobotPreview variant={variant} />
        <div className="panel-title">
          <div className="panel-name">
            {label}
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
            <span className="robot-level">Lv {level}</span>
          </div>
          <div className="panel-stats">
            DMG {robot.damage.toFixed(1)} · RATE {robot.fireRate.toFixed(2)}/s · RNG{" "}
            {robot.range.toFixed(1)} · DPS {dps.toFixed(1)} · SPD {robot.speed.toFixed(1)}
            {robot.attackSplashRadius > 0 && ` · SPL ${robot.attackSplashRadius.toFixed(1)}`}
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => setRobotPanelOpen(false)}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <div className="robot-sel-vitals">
        <div className="robot-sel-row">
          <span className="robot-sel-label">HP</span>
          <div className="robot-hp-bar">
            <div className="robot-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <span className="robot-sel-value">
            {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
          </span>
        </div>
        <div className="robot-sel-row">
          <span className="robot-sel-label">XP</span>
          <div className="robot-xp-bar">
            <div className="robot-xp-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <span className="robot-sel-value">
            {xpInto}/{xpNeed}
          </span>
        </div>
      </div>

      <div className="robot-sel-section-title">Abilities</div>
      <div className="robot-sel-abilities">
        {SLOT_KEYS.map(({ slot, key }) => {
          const dt = robotAbilityDamageType(spec, slot);
          const stats = formatAbilityStats(spec, slot);
          return (
            <div key={key} className="robot-sel-ability-info">
              <div className="robot-sel-ability-info-head">
                <span className="robot-sel-ability-glyph">{glyphs[slot]}</span>
                <div className="robot-sel-ability-info-title">
                  <div className="robot-sel-ability-name">
                    {labels[slot]}
                    {showKeyboardHints && <span className="robot-sel-ability-key">{key}</span>}
                  </div>
                  <span
                    className="dmg-tag"
                    style={{
                      color: DAMAGE_TYPE_COLOR[dt],
                      borderColor: DAMAGE_TYPE_COLOR[dt],
                    }}
                  >
                    <DamageIcon type={dt} size={11} title={DAMAGE_TYPE_LABEL[dt]} />
                    {DAMAGE_TYPE_LABEL[dt]}
                  </span>
                </div>
              </div>
              <p className="robot-sel-ability-blurb">{spec.abilityBlurbs[slot + 1]}</p>
              <ul className="robot-sel-ability-stats">
                {stats.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="robot-sel-blurb">{spec.blurb}</div>
    </RightOverlay>
  );
};
