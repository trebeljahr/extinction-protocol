import { HERO_SPECS } from "../sim/heroVariants";
import type { HeroAbilitySlot } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { HeroPreview } from "./HeroPreview";

const SLOT_KEYS: Array<{ slot: HeroAbilitySlot; key: "Q" | "W" | "E" | "R" }> = [
  { slot: 0, key: "Q" },
  { slot: 1, key: "W" },
  { slot: 2, key: "E" },
  { slot: 3, key: "R" },
];

export const HeroSelectionPanel = () => {
  const selected = useGame((s) => s.ui.heroSelected);
  const status = useGame((s) => s.ui.status);
  const variant = useGame((s) => s.ui.heroVariant);
  const label = useGame((s) => s.ui.heroLabel);
  const level = useGame((s) => s.ui.heroLevel);
  const xpInto = useGame((s) => s.ui.heroXpInto);
  const xpNeed = useGame((s) => s.ui.heroXpNeed);
  const hp = useGame((s) => s.ui.heroHp);
  const maxHp = useGame((s) => s.ui.heroMaxHp);
  const alive = useGame((s) => s.ui.heroAlive);
  const respawnRemaining = useGame((s) => s.ui.heroRespawnRemaining);
  const cooldowns = useGame((s) => s.ui.heroAbilityCooldowns);
  const maxCooldowns = useGame((s) => s.ui.heroAbilityMaxCooldowns);
  const labels = useGame((s) => s.ui.heroAbilityLabels);
  const glyphs = useGame((s) => s.ui.heroAbilityGlyphs);
  const trigger = useGame((s) => s.triggerHeroAbility);
  const selectHeroUnit = useGame((s) => s.selectHeroUnit);

  if (!selected || status !== "running") return null;

  const hero = useGame.getState().world.hero;
  const spec = HERO_SPECS[variant];
  const damageType = hero.damageType;
  const dps = hero.damage * hero.fireRate;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const xpPct = xpNeed > 0 ? Math.max(0, Math.min(1, xpInto / xpNeed)) : 0;

  return (
    <div className="tower-panel hero-selection-panel">
      <div className="panel-header">
        <HeroPreview variant={variant} />
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
            <span className="hero-level">Lv {level}</span>
          </div>
          <div className="panel-stats">
            DMG {hero.damage.toFixed(1)} · RATE {hero.fireRate.toFixed(2)}/s · RNG{" "}
            {hero.range.toFixed(1)} · DPS {dps.toFixed(1)} · SPD {hero.speed.toFixed(1)}
            {hero.attackSplashRadius > 0 && ` · SPL ${hero.attackSplashRadius.toFixed(1)}`}
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => selectHeroUnit(false)}
          aria-label="close"
        >
          ×
        </button>
      </div>

      <div className="hero-sel-vitals">
        <div className="hero-sel-row">
          <span className="hero-sel-label">HP</span>
          <div className="hero-hp-bar">
            <div className="hero-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <span className="hero-sel-value">
            {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
          </span>
        </div>
        <div className="hero-sel-row">
          <span className="hero-sel-label">XP</span>
          <div className="hero-xp-bar">
            <div className="hero-xp-fill" style={{ width: `${xpPct * 100}%` }} />
          </div>
          <span className="hero-sel-value">
            {xpInto}/{xpNeed}
          </span>
        </div>
      </div>

      <div className="hero-sel-section-title">Abilities</div>
      <div className="hero-sel-abilities">
        {SLOT_KEYS.map(({ slot, key }) => {
          const cd = cooldowns[slot];
          const max = maxCooldowns[slot];
          const ready = cd === 0 && alive;
          const fillPct = max > 0 ? Math.max(0, Math.min(1, 1 - cd / max)) : 1;
          return (
            <button
              key={key}
              type="button"
              className={`hero-sel-ability ${ready ? "ready" : "cooling"}`}
              onClick={() => trigger(slot)}
              disabled={!ready}
              title={`${labels[slot]} [${key}]`}
            >
              <span className="hero-sel-ability-glyph">{glyphs[slot]}</span>
              <div className="hero-sel-ability-body">
                <div className="hero-sel-ability-name">
                  {labels[slot]}
                  <span className="hero-sel-ability-key">{key}</span>
                </div>
                <div className="hero-sel-ability-meta">
                  {ready
                    ? `Ready · ${max.toFixed(1)}s CD`
                    : `${cd.toFixed(1)}s / ${max.toFixed(1)}s`}
                </div>
                <div className="hero-sel-ability-bar">
                  <div
                    className="hero-sel-ability-bar-fill"
                    style={{ width: `${fillPct * 100}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hero-sel-blurb">{spec.blurb}</div>
    </div>
  );
};
