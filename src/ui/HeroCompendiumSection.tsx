import type { ProgressData } from "../progress";
import { HERO_SPECS } from "../sim/heroVariants";
import type { HeroVariant } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { HeroDiorama } from "./HeroDiorama";

const ROSTER: HeroVariant[] = ["george", "leela", "mike", "stan"];

export const HeroCompendiumSection = ({ progress }: { progress: ProgressData }) => {
  return (
    <div className="hero-compendium-scroll">
      <div className="hero-compendium-grid">
        {ROSTER.map((variant) => {
          const spec = HERO_SPECS[variant];
          const unlocked = !!progress.heroUnlocks[variant];
          const xp = progress.heroXp[variant] ?? 0;
          return (
            <article
              key={variant}
              className="hero-compendium-card"
              data-variant={variant}
              data-locked={unlocked ? undefined : "true"}
            >
              <div className="hero-compendium-diorama">
                {unlocked ? (
                  <HeroDiorama variant={variant} />
                ) : (
                  <div className="hero-compendium-locked">
                    <span>★ {spec.unlockStars}</span>
                    <span className="hero-compendium-locked-label">LOCKED</span>
                  </div>
                )}
              </div>
              <div className="hero-compendium-body">
                <header className="hero-compendium-title">
                  <span className="hero-compendium-name">{spec.label}</span>
                  <span className="hero-compendium-callsign">{spec.callsign}</span>
                  <span
                    className="hero-compendium-dmg"
                    style={{ color: DAMAGE_TYPE_COLOR[spec.damageType] }}
                  >
                    {DAMAGE_TYPE_LABEL[spec.damageType]}
                  </span>
                  <span className="hero-compendium-xp">{xp} XP</span>
                </header>

                <p className="hero-compendium-blurb">{spec.blurb}</p>

                <dl className="hero-compendium-report">
                  <div className="hero-compendium-report-row hero-compendium-strength">
                    <dt>Strengths</dt>
                    <dd>{spec.strengths}</dd>
                  </div>
                  <div className="hero-compendium-report-row hero-compendium-weakness">
                    <dt>Weakness</dt>
                    <dd>{spec.weakness}</dd>
                  </div>
                </dl>

                <div className="hero-compendium-stats">
                  <div>
                    <span>HP</span> {spec.maxHp}
                  </div>
                  <div>
                    <span>SPD</span> {spec.speed}
                  </div>
                  <div>
                    <span>DMG</span> {spec.damage}
                  </div>
                  <div>
                    <span>RNG</span> {spec.range}
                  </div>
                  <div>
                    <span>ROF</span> {spec.fireRate}/s
                  </div>
                </div>

                <div className="hero-compendium-abilities">
                  {spec.abilityLabels.map((lbl, i) => (
                    <span key={lbl} className="hero-compendium-ability">
                      <span aria-hidden>{spec.abilityGlyphs[i]}</span> {lbl}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
