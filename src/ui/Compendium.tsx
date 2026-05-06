import { useEffect, useMemo, useState } from "react";
import { audio } from "../audio/AudioManager";
import { hasEncountered } from "../progress";
import { ENEMY_DESCRIPTION, ENEMY_SUBTITLE } from "../sim/enemyText";
import {
  MECHANIC_DESCRIPTION,
  MECHANIC_DETAIL,
  MECHANIC_LABEL,
  MECHANIC_ORDER,
  MECHANIC_SUBTITLE,
  type MechanicId,
} from "../sim/mechanicsText";
import {
  TOWER_BEHAVIOR,
  TOWER_DESCRIPTION,
  TOWER_MATCHUPS,
  TOWER_SUBTITLE,
} from "../sim/towerText";
import type { DamageType, EnemyKind, TowerKind } from "../sim/types";
import { UPGRADES } from "../sim/upgrades";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
  ENEMY_STATS,
  HIVE_BASE_DRONES,
  HIVE_BASE_SERVICE_BUFF,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  TOWER_LABEL,
  TOWER_STATS,
} from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyIcon } from "./EnemyIcon";
import { EnemyPreview } from "./EnemyPreview";
import { MechanicIcon } from "./MechanicIcon";
import { TowerPreview } from "./TowerPreview";

type Section = "enemy" | "tower" | "mechanic";

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
const TOWER_ORDER: TowerKind[] = ["pulse", "chain", "cryo", "mortar", "flame", "hive"];
const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

const SECTION_ORDER: Section[] = ["enemy", "tower", "mechanic"];
const SECTION_LABEL: Record<Section, string> = {
  enemy: "Enemies",
  tower: "Towers",
  mechanic: "Mechanics",
};

export const Compendium = () => {
  const progress = useGame((s) => s.progress);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);

  const [section, setSection] = useState<Section>("enemy");

  const firstEncountered = useMemo(
    () => ENEMY_ORDER.find((k) => hasEncountered(progress, k)) ?? ENEMY_ORDER[0],
    [progress],
  );
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyKind>(firstEncountered);
  const [selectedTower, setSelectedTower] = useState<TowerKind>(TOWER_ORDER[0]);
  const [selectedMech, setSelectedMech] = useState<MechanicId>(MECHANIC_ORDER[0]);

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

  const subtitle =
    section === "enemy"
      ? `${encounteredCount} / ${ENEMY_ORDER.length} species catalogued`
      : section === "tower"
        ? `${TOWER_ORDER.length} towers · ${DAMAGE_TYPES.length} damage types`
        : `${MECHANIC_ORDER.length} mechanics`;

  return (
    <div className="overlay compendium-overlay">
      <div className="compendium-card">
        <header className="compendium-header">
          <div>
            <h1>Compendium</h1>
            <div className="compendium-subtitle">{subtitle}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCompendiumOpen(false)}
          >
            Close (Esc)
          </button>
        </header>

        <div className="compendium-sections">
          {SECTION_ORDER.map((s) => (
            <button
              type="button"
              key={s}
              className={`compendium-section ${section === s ? "active" : ""}`}
              data-ui-sound="tab"
              onClick={() => setSection(s)}
            >
              {SECTION_LABEL[s]}
            </button>
          ))}
        </div>

        {section === "enemy" && (
          <EnemySectionView
            selected={selectedEnemy}
            setSelected={setSelectedEnemy}
            progress={progress}
          />
        )}
        {section === "tower" && (
          <TowerSectionView selected={selectedTower} setSelected={setSelectedTower} />
        )}
        {section === "mechanic" && (
          <MechanicSectionView selected={selectedMech} setSelected={setSelectedMech} />
        )}
      </div>
    </div>
  );
};

// --- Enemy section ---------------------------------------------------------

const EnemySectionView = ({
  selected,
  setSelected,
  progress,
}: {
  selected: EnemyKind;
  setSelected: (k: EnemyKind) => void;
  progress: ReturnType<typeof useGame.getState>["progress"];
}) => {
  const selectedSeen = hasEncountered(progress, selected);
  return (
    <>
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
              <span className="compendium-tab-icon" aria-hidden>
                {seen ? (
                  <EnemyIcon kind={kind} />
                ) : (
                  <span className="compendium-tab-locked-glyph">?</span>
                )}
              </span>
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
              <EnemyStatRow kind={selected} />
              <EnemyResistRow kind={selected} />
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
    </>
  );
};

const EnemyStatRow = ({ kind }: { kind: EnemyKind }) => {
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

const EnemyResistRow = ({ kind }: { kind: EnemyKind }) => {
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

// --- Tower section ---------------------------------------------------------

const TowerSectionView = ({
  selected,
  setSelected,
}: {
  selected: TowerKind;
  setSelected: (k: TowerKind) => void;
}) => {
  const stats = TOWER_STATS[selected];
  const cost = TOWER_COST[selected];
  const dmgType = TOWER_DAMAGE_TYPE[selected];
  const tree = UPGRADES[selected];
  const isHive = selected === "hive";
  const isCryo = selected === "cryo";
  const isChain = selected === "chain";
  const isMortar = selected === "mortar";

  return (
    <>
      <div className="compendium-selector">
        {TOWER_ORDER.map((kind) => (
          <button
            type="button"
            key={kind}
            className={`compendium-tab ${selected === kind ? "active" : ""}`}
            data-ui-sound="tab"
            onClick={() => setSelected(kind)}
            title={TOWER_LABEL[kind]}
          >
            <span className="compendium-tab-index">{TOWER_ORDER.indexOf(kind) + 1}</span>
            <span className="compendium-tab-name">{TOWER_LABEL[kind]}</span>
          </button>
        ))}
      </div>

      <div className="compendium-detail">
        <div className="compendium-detail-preview compendium-tower-preview">
          <TowerPreview kind={selected} />
        </div>
        <div className="compendium-detail-info">
          <div className="compendium-detail-head">
            <div className="compendium-detail-name">{TOWER_LABEL[selected]}</div>
            <div className="compendium-detail-subtitle">
              {!isHive && (
                <>
                  <span
                    className="compendium-detail-damage-type"
                    style={{ color: DAMAGE_TYPE_COLOR[dmgType] }}
                  >
                    <DamageIcon type={dmgType} size={14} />
                    {DAMAGE_TYPE_LABEL[dmgType]}
                  </span>
                  <span className="compendium-detail-divider">·</span>
                </>
              )}
              <span>{TOWER_SUBTITLE[selected]}</span>
              <span className="compendium-detail-divider">·</span>
              <span>{cost}g</span>
            </div>
          </div>
          <p className="compendium-detail-desc">{TOWER_DESCRIPTION[selected]}</p>

          <dl className="compendium-stats">
            {isHive ? (
              <>
                <div>
                  <dt>Drones</dt>
                  <dd>{HIVE_BASE_DRONES}</dd>
                </div>
                <div>
                  <dt>Buff</dt>
                  <dd>+{Math.round(HIVE_BASE_SERVICE_BUFF * 100)}%</dd>
                </div>
                <div>
                  <dt>Cost</dt>
                  <dd>{cost}g</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>Support</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>{isCryo ? "Slow" : "DMG"}</dt>
                  <dd>{isCryo ? `${Math.round((1 - stats.slowFactor) * 100)}%` : stats.damage}</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>{stats.fireRate.toFixed(1)}/s</dd>
                </div>
                <div>
                  <dt>Range</dt>
                  <dd>{stats.range.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>{isMortar ? "Splash" : isChain ? "Chain" : isCryo ? "Chill" : "Cost"}</dt>
                  <dd>
                    {isMortar
                      ? stats.splashRadius.toFixed(1)
                      : isChain
                        ? `${stats.chainCount}`
                        : isCryo
                          ? `${stats.slowDuration.toFixed(1)}s`
                          : `${cost}g`}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <div className="compendium-section-block">
            <div className="compendium-resist-label">Behavior</div>
            <p className="compendium-detail-desc">{TOWER_BEHAVIOR[selected]}</p>
          </div>

          <div className="compendium-section-block">
            <div className="compendium-resist-label">Upgrade tree</div>
            <div className="compendium-upgrades">
              {(["a", "b"] as const).map((branchId) => {
                const branch = tree[branchId];
                return (
                  <div key={branchId} className="compendium-branch">
                    <div className="compendium-branch-label">
                      Path {branchId.toUpperCase()} · {branch.label}
                    </div>
                    <ol className="compendium-branch-tiers">
                      {branch.tiers.map((tier) => (
                        <li key={tier.name}>
                          <span className="compendium-tier-name">{tier.name}</span>
                          <span className="compendium-tier-desc">{tier.desc}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="compendium-section-block">
            <div className="compendium-resist-label">Matchups</div>
            <p className="compendium-detail-desc">{TOWER_MATCHUPS[selected]}</p>
          </div>
        </div>
      </div>
    </>
  );
};

// --- Mechanics section -----------------------------------------------------

const MechanicSectionView = ({
  selected,
  setSelected,
}: {
  selected: MechanicId;
  setSelected: (id: MechanicId) => void;
}) => {
  return (
    <>
      <div className="compendium-selector">
        {MECHANIC_ORDER.map((id) => (
          <button
            type="button"
            key={id}
            className={`compendium-tab ${selected === id ? "active" : ""}`}
            data-ui-sound="tab"
            onClick={() => setSelected(id)}
            title={MECHANIC_LABEL[id]}
          >
            <span className="compendium-tab-index">{MECHANIC_ORDER.indexOf(id) + 1}</span>
            <span className="compendium-tab-name">{MECHANIC_LABEL[id]}</span>
          </button>
        ))}
      </div>

      <div className="compendium-detail">
        <div className="compendium-detail-preview">
          <MechanicIcon id={selected} size={360} />
        </div>
        <div className="compendium-detail-info">
          <div className="compendium-detail-head">
            <div className="compendium-detail-name">{MECHANIC_LABEL[selected]}</div>
            <div className="compendium-detail-subtitle">{MECHANIC_SUBTITLE[selected]}</div>
          </div>
          <p className="compendium-detail-desc">{MECHANIC_DESCRIPTION[selected]}</p>
          <div className="compendium-section-block">
            <div className="compendium-resist-label">How it works</div>
            <p className="compendium-detail-desc">{MECHANIC_DETAIL[selected]}</p>
          </div>
        </div>
      </div>
    </>
  );
};
