import type { HeroAbilitySlot } from "../sim/types";
import { useGame } from "../store";

// QWER hotkey map. Slot 3 (R) is always the ultimate so the climactic
// move sits on the same key across pilots — League-style muscle memory.
const SLOT_KEYS: Array<{ slot: HeroAbilitySlot; key: "Q" | "W" | "E" | "R" }> = [
  { slot: 0, key: "Q" },
  { slot: 1, key: "W" },
  { slot: 2, key: "E" },
  { slot: 3, key: "R" },
];

// In-game HUD strip: HP/XP bar plus the four ability buttons. The hero
// menu (HeroShop) is opened from the top-left banner only — not from
// this panel, not from the hero name. Clicking an ability triggers it
// the same way the hotkey would.
export const HeroPanel = () => {
  const label = useGame((s) => s.ui.heroLabel);
  const hp = useGame((s) => s.ui.heroHp);
  const maxHp = useGame((s) => s.ui.heroMaxHp);
  const alive = useGame((s) => s.ui.heroAlive);
  const respawnRemaining = useGame((s) => s.ui.heroRespawnRemaining);
  const level = useGame((s) => s.ui.heroLevel);
  const xpInto = useGame((s) => s.ui.heroXpInto);
  const xpNeed = useGame((s) => s.ui.heroXpNeed);
  const cooldowns = useGame((s) => s.ui.heroAbilityCooldowns);
  const maxCooldowns = useGame((s) => s.ui.heroAbilityMaxCooldowns);
  const labels = useGame((s) => s.ui.heroAbilityLabels);
  const glyphs = useGame((s) => s.ui.heroAbilityGlyphs);
  const trigger = useGame((s) => s.triggerHeroAbility);

  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const xpPct = xpNeed > 0 ? Math.max(0, Math.min(1, xpInto / xpNeed)) : 0;

  return (
    <div className="hero-panel">
      <div className="hero-portrait">
        <div className="hero-name">
          MECHA · {label.toUpperCase()}
          <span className="hero-level">Lv {level}</span>
        </div>
        <div className="hero-xp-row">
          <div className="hero-xp-bar">
            <div className="hero-xp-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <span className="hero-xp-value">
            {xpInto}/{xpNeed} XP
          </span>
        </div>
        <div className="hero-hp-row">
          <span className="hero-hp-label">HP</span>
          <div className="hero-hp-bar">
            <div className="hero-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <span className="hero-hp-value">
            {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
          </span>
        </div>
      </div>
      <div className="hero-abilities">
        {SLOT_KEYS.map(({ slot, key }) => {
          const cd = cooldowns[slot];
          const max = maxCooldowns[slot];
          const ready = cd === 0 && alive;
          const fillPct = max > 0 ? Math.max(0, Math.min(1, 1 - cd / max)) : 1;
          return (
            <button
              key={key}
              type="button"
              className={`hero-ability ${ready ? "ready" : "cooling"}`}
              onClick={() => trigger(slot)}
              disabled={!ready}
              title={`${labels[slot]} [${key}]`}
            >
              <span className="hero-ability-glyph">{glyphs[slot]}</span>
              <span className="hero-ability-key">{key}</span>
              <div className="hero-ability-fill" style={{ width: `${fillPct * 100}%` }} />
              {cd > 0 && <span className="hero-ability-cd">{cd.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
