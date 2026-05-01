import { useEffect, useMemo, useState } from "react";
import { audio } from "../audio/AudioManager";
import { hasEncountered } from "../progress";
import { ENEMY_DESCRIPTION, ENEMY_SUBTITLE } from "../sim/enemyText";
import type { DamageType, EnemyKind } from "../sim/types";
import {
  DAMAGE_TYPE_LABEL,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
  ENEMY_STATS,
} from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyPreview } from "./EnemyPreview";

const ENEMY_ORDER: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
];
const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

export const Compendium = () => {
  const progress = useGame((s) => s.progress);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);

  const firstEncountered = useMemo(
    () => ENEMY_ORDER.find((k) => hasEncountered(progress, k)) ?? ENEMY_ORDER[0],
    [progress],
  );
  const [selected, setSelected] = useState<EnemyKind>(firstEncountered);

  useEffect(() => {
    audio.ui("open");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setCompendiumOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setCompendiumOpen]);

  const encounteredCount = ENEMY_ORDER.filter((k) => hasEncountered(progress, k)).length;
  const selectedSeen = hasEncountered(progress, selected);

  return (
    <div className="overlay compendium-overlay">
      <div className="compendium-card">
        <header className="compendium-header">
          <div>
            <h1>Enemy Compendium</h1>
            <div className="compendium-subtitle">
              {encounteredCount} / {ENEMY_ORDER.length} species catalogued
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCompendiumOpen(false)}
          >
            Close (Esc)
          </button>
        </header>

        <div className="compendium-selector">
          {ENEMY_ORDER.map((kind) => {
            const seen = hasEncountered(progress, kind);
            return (
              <button
                type="button"
                key={kind}
                className={`compendium-tab ${selected === kind ? "active" : ""} ${seen ? "" : "locked"}`}
                data-ui-sound="tab"
                onClick={() => setSelected(kind)}
                disabled={!seen}
                title={seen ? ENEMY_LABEL[kind] : "Not yet encountered"}
              >
                <span className="compendium-tab-index">{ENEMY_ORDER.indexOf(kind) + 1}</span>
                <span className="compendium-tab-name">{seen ? ENEMY_LABEL[kind] : "???"}</span>
              </button>
            );
          })}
        </div>

        <div className="compendium-detail">
          <div className="compendium-detail-preview">
            {selectedSeen ? (
              <EnemyPreview kind={selected} size={360} />
            ) : (
              <div className="compendium-detail-locked">?</div>
            )}
          </div>
          <div className="compendium-detail-info">
            {selectedSeen ? (
              <>
                <div className="compendium-detail-head">
                  <div className="compendium-detail-name">{ENEMY_LABEL[selected]}</div>
                  <div className="compendium-detail-subtitle">{ENEMY_SUBTITLE[selected]}</div>
                </div>
                <p className="compendium-detail-desc">{ENEMY_DESCRIPTION[selected]}</p>
                <StatRow kind={selected} />
                <ResistRow kind={selected} />
              </>
            ) : (
              <div className="compendium-detail-locked-text">
                <div className="compendium-detail-name">Unknown species</div>
                <p className="compendium-detail-desc">
                  Encounter this enemy in combat to unlock its dossier.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ kind }: { kind: EnemyKind }) => {
  const s = ENEMY_STATS[kind];
  return (
    <dl className="compendium-stats">
      <div>
        <dt>HP</dt>
        <dd>{s.hp}</dd>
      </div>
      <div>
        <dt>Speed</dt>
        <dd>{s.speed.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Damage</dt>
        <dd>{s.damage}</dd>
      </div>
      <div>
        <dt>Bounty</dt>
        <dd>{s.bounty}g</dd>
      </div>
    </dl>
  );
};

const ResistRow = ({ kind }: { kind: EnemyKind }) => {
  const slowResist = ENEMY_SLOW_RESIST[kind];
  return (
    <div className="compendium-resist">
      <div className="compendium-resist-label">vs. damage</div>
      <div className="compendium-resist-chips">
        {DAMAGE_TYPES.map((dt) => {
          const mul = ENEMY_RESIST[kind][dt];
          const pct = Math.round((mul - 1) * 100);
          const tone = pct > 0 ? "weak" : pct < 0 ? "resist" : "neutral";
          return (
            <div
              key={dt}
              className={`compendium-chip ${tone}`}
              title={`${DAMAGE_TYPE_LABEL[dt]}: ${mul.toFixed(2)}×`}
            >
              <DamageIcon type={dt} size={20} />
              <span className="compendium-chip-label">{DAMAGE_TYPE_LABEL[dt]}</span>
              <span className="compendium-chip-val">
                {pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "·"}
              </span>
            </div>
          );
        })}
        {slowResist > 0 && (
          <div
            className="compendium-chip resist"
            title={`Slow resist: ${Math.round(slowResist * 100)}%`}
          >
            <span className="compendium-chip-glyph" aria-hidden>
              S
            </span>
            <span className="compendium-chip-label">Slow</span>
            <span className="compendium-chip-val">-{Math.round(slowResist * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
