import type { RobotAbilitySlot } from "../sim/types";
import { clamp01 } from "../sim/vec2";
import { useGame } from "../store";
import { fmtCompact } from "./format";

// QWER hotkey map. Slot 3 (R) is always the ultimate so the climactic
// move sits on the same key across pilots — League-style muscle memory.
const SLOT_KEYS: Array<{ slot: RobotAbilitySlot; key: "Q" | "W" | "E" | "R" }> = [
  { slot: 0, key: "Q" },
  { slot: 1, key: "W" },
  { slot: 2, key: "E" },
  { slot: 3, key: "R" },
];

// In-game HUD strip: HP/XP bar plus the four ability buttons. Clicking
// the portrait area (name / HP / XP / combat stats) opens the read-only
// robot overview overlay. Clicking an ability triggers it the same way
// the hotkey would.
export const RobotPanel = () => {
  const label = useGame((s) => s.ui.robotLabel);
  const hp = useGame((s) => s.ui.robotHp);
  const maxHp = useGame((s) => s.ui.robotMaxHp);
  const alive = useGame((s) => s.ui.robotAlive);
  const respawnRemaining = useGame((s) => s.ui.robotRespawnRemaining);
  const level = useGame((s) => s.ui.robotLevel);
  const xpInto = useGame((s) => s.ui.robotXpInto);
  const xpNeed = useGame((s) => s.ui.robotXpNeed);
  const cooldowns = useGame((s) => s.ui.robotAbilityCooldowns);
  const activeRemaining = useGame((s) => s.ui.robotAbilityActiveRemaining);
  const maxCooldowns = useGame((s) => s.ui.robotAbilityMaxCooldowns);
  const labels = useGame((s) => s.ui.robotAbilityLabels);
  const glyphs = useGame((s) => s.ui.robotAbilityGlyphs);
  const kills = useGame((s) => s.ui.robotKills);
  const dps = useGame((s) => s.ui.robotDps);
  const damageDealt = useGame((s) => s.ui.robotDamageDealt);
  const trigger = useGame((s) => s.triggerRobotAbility);
  const panelOpen = useGame((s) => s.robotPanelOpen);
  const setRobotPanelOpen = useGame((s) => s.setRobotPanelOpen);

  const hpPct = maxHp > 0 ? clamp01(hp / maxHp) : 0;
  const xpPct = xpNeed > 0 ? clamp01(xpInto / xpNeed) : 0;

  return (
    <div className="robot-panel">
      <button
        type="button"
        className={`robot-portrait ${panelOpen ? "active" : ""}`}
        onClick={() => setRobotPanelOpen(!panelOpen)}
        aria-pressed={panelOpen}
        aria-label="Toggle robot overview"
        title="Robot overview"
      >
        <div className="robot-name">
          MECHA · {label.toUpperCase()}
          <span className="robot-level">Lv {level}</span>
        </div>
        <div className="robot-xp-row">
          <div className="robot-xp-bar">
            <div className="robot-xp-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <span className="robot-xp-value">
            {xpInto}/{xpNeed} XP
          </span>
        </div>
        <div className="robot-hp-row">
          <span className="robot-hp-label">HP</span>
          <div className="robot-hp-bar">
            <div className="robot-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <span className="robot-hp-value">
            {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
          </span>
        </div>
        <div className="robot-combat-row">
          DPS {dps.toFixed(1)} · KILLS {kills} · DEALT {fmtCompact(damageDealt)}
        </div>
      </button>
      <div className="robot-abilities">
        {SLOT_KEYS.map(({ slot, key }) => {
          const cd = cooldowns[slot];
          const active = activeRemaining[slot] > 0;
          const max = maxCooldowns[slot];
          const ready = cd === 0 && alive;
          const fillPct = max > 0 ? clamp01(1 - cd / max) : 1;
          const title = active
            ? `${labels[slot]} [${key}] - Active ${activeRemaining[slot].toFixed(1)}s remaining`
            : `${labels[slot]} [${key}]`;
          return (
            <button
              key={key}
              type="button"
              className={`robot-ability ${active ? "active" : ""} ${ready ? "ready" : "cooling"}`}
              onClick={() => trigger(slot)}
              disabled={!ready}
              aria-label={title}
              aria-pressed={active}
              title={title}
            >
              <span className="robot-ability-glyph">{glyphs[slot]}</span>
              <span className="robot-ability-key">{key}</span>
              <div className="robot-ability-fill" style={{ width: `${fillPct * 100}%` }} />
              {active && <span className="robot-ability-active">ON</span>}
              {cd > 0 && <span className="robot-ability-cd">{cd.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
