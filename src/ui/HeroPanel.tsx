import { HERO_BARRAGE_COOLDOWN, HERO_DASH_COOLDOWN, HERO_SHOCKWAVE_COOLDOWN } from "../sim/world";
import { useGame } from "../store";

type AbilitySpec = {
  key: "Z" | "X" | "C";
  ability: "dash" | "shockwave" | "barrage";
  label: string;
  glyph: string;
};

const ABILITIES: AbilitySpec[] = [
  { key: "Z", ability: "dash", label: "Dash", glyph: "»" },
  { key: "X", ability: "shockwave", label: "Shockwave", glyph: "✺" },
  { key: "C", ability: "barrage", label: "Barrage", glyph: "❖" },
];

const COOLDOWN_MAX: Record<AbilitySpec["ability"], number> = {
  dash: HERO_DASH_COOLDOWN,
  shockwave: HERO_SHOCKWAVE_COOLDOWN,
  barrage: HERO_BARRAGE_COOLDOWN,
};

export const HeroPanel = () => {
  const hp = useGame((s) => s.ui.heroHp);
  const maxHp = useGame((s) => s.ui.heroMaxHp);
  const alive = useGame((s) => s.ui.heroAlive);
  const respawnRemaining = useGame((s) => s.ui.heroRespawnRemaining);
  const dashCd = useGame((s) => s.ui.heroDashCooldown);
  const shockCd = useGame((s) => s.ui.heroShockwaveCooldown);
  const barrageCd = useGame((s) => s.ui.heroBarrageCooldown);
  const trigger = useGame((s) => s.triggerHeroAbility);

  const cooldown = (ab: AbilitySpec["ability"]): number =>
    ab === "dash" ? dashCd : ab === "shockwave" ? shockCd : barrageCd;

  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  return (
    <div className="hero-panel">
      <div className="hero-portrait">
        <div className="hero-name">MECHA · George</div>
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
        {ABILITIES.map((a) => {
          const cd = cooldown(a.ability);
          const ready = cd === 0 && alive;
          const max = COOLDOWN_MAX[a.ability];
          const fillPct = max > 0 ? Math.max(0, Math.min(1, 1 - cd / max)) : 1;
          return (
            <button
              key={a.ability}
              type="button"
              className={`hero-ability ${ready ? "ready" : "cooling"}`}
              onClick={() => trigger(a.ability)}
              disabled={!ready}
              title={`${a.label} [${a.key}]`}
            >
              <span className="hero-ability-glyph">{a.glyph}</span>
              <span className="hero-ability-key">{a.key}</span>
              <div className="hero-ability-fill" style={{ width: `${fillPct * 100}%` }} />
              {cd > 0 && <span className="hero-ability-cd">{cd.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
