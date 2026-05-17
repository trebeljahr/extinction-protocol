import type { ProgressData } from "../progress";
import { ROBOT_SPECS } from "../sim/robotVariants";
import type { RobotVariant } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { RobotDiorama } from "./RobotDiorama";

const ROSTER: RobotVariant[] = ["george", "leela", "mike", "stan"];

export const RobotCompendiumSection = ({ progress }: { progress: ProgressData }) => {
  return (
    <div className="robot-compendium-scroll">
      <div className="robot-compendium-grid">
        {ROSTER.map((variant) => {
          const spec = ROBOT_SPECS[variant];
          const unlocked = !!progress.robotUnlocks[variant];
          const xp = progress.robotXp[variant] ?? 0;
          return (
            <article
              key={variant}
              className="robot-compendium-card"
              data-variant={variant}
              data-locked={unlocked ? undefined : "true"}
            >
              <div className="robot-compendium-diorama">
                {unlocked ? (
                  <RobotDiorama variant={variant} />
                ) : (
                  <div className="robot-compendium-locked">
                    <span>★ {spec.unlockStars}</span>
                    <span className="robot-compendium-locked-label">LOCKED</span>
                  </div>
                )}
              </div>
              <div className="robot-compendium-body">
                <header className="robot-compendium-title">
                  <span className="robot-compendium-name">{spec.label}</span>
                  <span className="robot-compendium-callsign">{spec.callsign}</span>
                  <span
                    className="robot-compendium-dmg"
                    style={{ color: DAMAGE_TYPE_COLOR[spec.damageType] }}
                  >
                    {DAMAGE_TYPE_LABEL[spec.damageType]}
                  </span>
                  <span className="robot-compendium-xp">{xp} XP</span>
                </header>

                <p className="robot-compendium-blurb">{spec.blurb}</p>

                <dl className="robot-compendium-report">
                  <div className="robot-compendium-report-row robot-compendium-strength">
                    <dt>Strengths</dt>
                    <dd>{spec.strengths}</dd>
                  </div>
                  <div className="robot-compendium-report-row robot-compendium-weakness">
                    <dt>Weakness</dt>
                    <dd>{spec.weakness}</dd>
                  </div>
                </dl>

                <div className="robot-compendium-stats">
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

                <div className="robot-compendium-abilities">
                  {spec.abilityLabels.map((lbl, i) => (
                    <span key={lbl} className="robot-compendium-ability">
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
