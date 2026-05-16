import { useEffect, useMemo, useRef, useState } from "react";
import { useGamepadInput } from "../input/gamepad";
import { hasEncountered, hasMatriarchEncountered } from "../progress";
import {
  ENEMY_DESCRIPTION,
  ENEMY_SUBTITLE,
  MATRIARCH_DESCRIPTION,
  MATRIARCH_SUBTITLE,
} from "../sim/enemyText";
import {
  MECHANIC_DESCRIPTION,
  MECHANIC_LABEL,
  MECHANIC_ORDER,
  MECHANIC_STATS,
  MECHANIC_SUBTITLE,
  type MechanicId,
} from "../sim/mechanicsText";
import {
  TOWER_BEHAVIOR,
  TOWER_DESCRIPTION,
  TOWER_MATCHUPS,
  TOWER_SUBTITLE,
} from "../sim/towerText";
import type { BossVariant, DamageType, EnemyKind, TowerKind } from "../sim/types";
import { UPGRADES } from "../sim/upgrades";
import {
  BOSS_VARIANT_LABEL,
  BOSS_VARIANT_RESIST,
  BOSS_VARIANT_SLOW_RESIST,
  BOSS_VARIANT_STATS,
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
import { HeroCompendiumSection } from "./HeroCompendiumSection";
import { MechanicIcon } from "./MechanicIcon";
import { MechanicPreview } from "./MechanicPreview";
import { TowerDiorama } from "./TowerDiorama";
import { TowerPreview } from "./TowerPreview";

type Section = "enemy" | "tower" | "mechanic" | "hero";

// Compendium enemy entries — either a base species or a biome-themed
// matriarch variant. The list is rendered in one row so the player
// reads the dossier as a single bestiary, but stats/labels dispatch on
// `kind` since the variant data lives in BOSS_VARIANT_* tables.
type EnemyEntry = { kind: "species"; id: EnemyKind } | { kind: "matriarch"; variant: BossVariant };

const ENEMY_SPECIES_ORDER: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
];

// Matriarchs are ordered by the wave they first appear on so the
// compendium reads in the same order the player encounters them.
const MATRIARCH_ORDER: BossVariant[] = ["raptor", "stego", "para", "allosaur", "armored", "apex"];

const ENEMY_ENTRIES: EnemyEntry[] = [
  ...ENEMY_SPECIES_ORDER.map<EnemyEntry>((id) => ({ kind: "species", id })),
  ...MATRIARCH_ORDER.map<EnemyEntry>((variant) => ({ kind: "matriarch", variant })),
];

const entryKey = (e: EnemyEntry): string =>
  e.kind === "species" ? `species:${e.id}` : `matriarch:${e.variant}`;

const entrySeen = (e: EnemyEntry, p: ReturnType<typeof useGame.getState>["progress"]): boolean =>
  e.kind === "species" ? hasEncountered(p, e.id) : hasMatriarchEncountered(p, e.variant);

const entryLabel = (e: EnemyEntry): string =>
  e.kind === "species" ? ENEMY_LABEL[e.id] : BOSS_VARIANT_LABEL[e.variant];

const entrySubtitle = (e: EnemyEntry): string =>
  e.kind === "species" ? ENEMY_SUBTITLE[e.id] : MATRIARCH_SUBTITLE[e.variant];

const entryDescription = (e: EnemyEntry): string =>
  e.kind === "species" ? ENEMY_DESCRIPTION[e.id] : MATRIARCH_DESCRIPTION[e.variant];
const TOWER_ORDER: TowerKind[] = ["pulse", "chain", "cryo", "mortar", "flame", "hive"];
const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

const SECTION_ORDER: Section[] = ["enemy", "tower", "mechanic", "hero"];
const SECTION_LABEL: Record<Section, string> = {
  enemy: "Enemies",
  tower: "Towers",
  mechanic: "Mechanics",
  hero: "Pilots",
};

export const Compendium = () => {
  const progress = useGame((s) => s.progress);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);

  const [section, setSection] = useState<Section>("enemy");

  const firstEncountered = useMemo(
    () => ENEMY_ENTRIES.find((e) => entrySeen(e, progress)) ?? ENEMY_ENTRIES[0],
    [progress],
  );
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyEntry>(firstEncountered);
  const [selectedTower, setSelectedTower] = useState<TowerKind>(TOWER_ORDER[0]);
  const [selectedMech, setSelectedMech] = useState<MechanicId>(MECHANIC_ORDER[0]);

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

  // The global menu-nav hook (App.tsx) already wires dpad focus, A
  // activate, and B/Start escape for every modal. Compendium adds
  // LB/RB to jump between sections so a gamepad user doesn't have to
  // step focus through dozens of item tabs just to switch tab strips.
  // No conflict with Placement's LB/RB tower cycling — that handler
  // early-returns while compendiumOpen is true.
  const sectionRef = useRef(section);
  sectionRef.current = section;
  useGamepadInput((frame) => {
    if (!frame.gamepad) return;
    const cycle = (direction: -1 | 1) => {
      const idx = SECTION_ORDER.indexOf(sectionRef.current);
      const next = (idx + direction + SECTION_ORDER.length) % SECTION_ORDER.length;
      setSection(SECTION_ORDER[next]);
    };
    if (frame.buttonPressed("lb")) cycle(-1);
    if (frame.buttonPressed("rb")) cycle(1);
  });

  const encounteredCount = ENEMY_ENTRIES.filter((e) => entrySeen(e, progress)).length;

  const subtitle =
    section === "enemy"
      ? `${encounteredCount} / ${ENEMY_ENTRIES.length} species catalogued`
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
            className="btn-close compendium-close"
            onClick={() => setCompendiumOpen(false)}
            aria-label="Close compendium"
            title="Close compendium"
          >
            ×
          </button>
        </header>

        <div className="compendium-sections">
          {SECTION_ORDER.map((s) => (
            <button
              type="button"
              key={s}
              className={`compendium-section ${section === s ? "active" : ""}`}
              onClick={() => setSection(s)}
              aria-pressed={section === s}
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
        {section === "hero" && <HeroCompendiumSection progress={progress} />}
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
  selected: EnemyEntry;
  setSelected: (e: EnemyEntry) => void;
  progress: ReturnType<typeof useGame.getState>["progress"];
}) => {
  const selectedSeen = entrySeen(selected, progress);
  const selectedKey = entryKey(selected);
  return (
    <div className="compendium-browser">
      <div className="compendium-selector">
        {ENEMY_ENTRIES.map((entry) => {
          const seen = entrySeen(entry, progress);
          const key = entryKey(entry);
          const isMatriarch = entry.kind === "matriarch";
          return (
            <button
              type="button"
              key={key}
              className={`compendium-tab ${selectedKey === key ? "active" : ""} ${seen ? "" : "locked"} ${isMatriarch ? "matriarch" : ""}`}
              onClick={() => setSelected(entry)}
              disabled={!seen}
              aria-pressed={selectedKey === key}
              title={seen ? entryLabel(entry) : "Not yet encountered"}
            >
              <span className="compendium-tab-icon" aria-hidden>
                {seen ? (
                  entry.kind === "species" ? (
                    <EnemyIcon kind={entry.id} />
                  ) : (
                    <EnemyIcon kind="boss" bossVariant={entry.variant} />
                  )
                ) : (
                  <span className="compendium-tab-locked-glyph">?</span>
                )}
              </span>
              <span className="compendium-tab-name">{seen ? entryLabel(entry) : "???"}</span>
            </button>
          );
        })}
      </div>

      <div className="compendium-detail">
        <div className="compendium-detail-preview">
          {selectedSeen ? (
            selected.kind === "species" ? (
              <EnemyPreview kind={selected.id} size={360} />
            ) : (
              <EnemyPreview kind="boss" bossVariant={selected.variant} size={360} />
            )
          ) : (
            <div className="compendium-detail-locked">?</div>
          )}
        </div>
        <div className="compendium-detail-info">
          {selectedSeen ? (
            <>
              <div className="compendium-detail-head">
                <div className="compendium-detail-name">{entryLabel(selected)}</div>
                <div className="compendium-detail-subtitle">{entrySubtitle(selected)}</div>
              </div>
              <p className="compendium-detail-desc">{entryDescription(selected)}</p>
              {selected.kind === "matriarch" && (
                <div className="flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg bg-[rgba(255,90,58,0.10)] border border-[rgba(255,90,58,0.45)]">
                  <span className="text-[10px] tracking-[0.16em] text-[#ff8a6a] uppercase font-bold">
                    Leak damage
                  </span>
                  <span className="ml-auto text-[#ffb39a] text-[13px] font-semibold tabular-nums">
                    {BOSS_VARIANT_STATS[selected.variant].damage} lives — instant loss
                  </span>
                </div>
              )}
              <EnemyStatRow entry={selected} />
              <EnemyResistRow entry={selected} />
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
  );
};

const statsFor = (entry: EnemyEntry) =>
  entry.kind === "species" ? ENEMY_STATS[entry.id] : BOSS_VARIANT_STATS[entry.variant];

const resistFor = (entry: EnemyEntry, dt: DamageType) =>
  entry.kind === "species" ? ENEMY_RESIST[entry.id][dt] : BOSS_VARIANT_RESIST[entry.variant][dt];

const slowResistFor = (entry: EnemyEntry) =>
  entry.kind === "species" ? ENEMY_SLOW_RESIST[entry.id] : BOSS_VARIANT_SLOW_RESIST[entry.variant];

const EnemyStatRow = ({ entry }: { entry: EnemyEntry }) => {
  const s = statsFor(entry);
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

const EnemyResistRow = ({ entry }: { entry: EnemyEntry }) => {
  const slowResist = slowResistFor(entry);
  return (
    <div className="compendium-resist">
      <div className="compendium-resist-label">vs. damage</div>
      <div className="compendium-resist-chips">
        {DAMAGE_TYPES.map((dt) => {
          const mul = resistFor(entry, dt);
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
  // Debug-only override — production never sets entries here so all towers
  // render as unlocked. The debug menu lets a tester flip them so the
  // compendium's locked layout can be inspected.
  const towerLocks = useGame((s) => s.compendiumLocks.towers);
  const selectedLocked = towerLocks[selected] === true;

  return (
    <div className="compendium-browser">
      <div className="compendium-selector">
        {TOWER_ORDER.map((kind) => {
          const locked = towerLocks[kind] === true;
          return (
            <button
              type="button"
              key={kind}
              className={`compendium-tab ${selected === kind ? "active" : ""} ${locked ? "locked" : ""}`}
              onClick={() => setSelected(kind)}
              disabled={locked}
              aria-pressed={selected === kind}
              title={locked ? "Locked" : TOWER_LABEL[kind]}
            >
              <span className="compendium-tab-icon" aria-hidden>
                {locked ? (
                  <span className="compendium-tab-locked-glyph">?</span>
                ) : (
                  <TowerPreview kind={kind} />
                )}
              </span>
              <span className="compendium-tab-name">{locked ? "???" : TOWER_LABEL[kind]}</span>
            </button>
          );
        })}
      </div>

      {selectedLocked ? (
        <div className="compendium-detail">
          <div className="compendium-detail-preview">
            <div className="compendium-detail-locked">?</div>
          </div>
          <div className="compendium-detail-info">
            <div className="compendium-detail-locked-text">
              <div className="compendium-detail-name">Unknown defense</div>
              <p className="compendium-detail-desc">
                Field-test a successful deployment to unlock this tower's dossier.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="compendium-detail">
          <div className="compendium-detail-preview">
            <TowerDiorama kind={selected} size={360} />
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
                    <dd>
                      {isCryo ? `${Math.round((1 - stats.slowFactor) * 100)}%` : stats.damage}
                    </dd>
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
      )}
    </div>
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
  // Same debug-only override pattern as towers — production never sets
  // entries here so mechanics always render unlocked under normal play.
  const mechLocks = useGame((s) => s.compendiumLocks.mechanics);
  const selectedLocked = mechLocks[selected] === true;
  return (
    <div className="compendium-browser">
      <div className="compendium-selector">
        {MECHANIC_ORDER.map((id) => {
          const locked = mechLocks[id] === true;
          return (
            <button
              type="button"
              key={id}
              className={`compendium-tab ${selected === id ? "active" : ""} ${locked ? "locked" : ""}`}
              onClick={() => setSelected(id)}
              disabled={locked}
              aria-pressed={selected === id}
              title={locked ? "Locked" : MECHANIC_LABEL[id]}
            >
              <span className="compendium-tab-index">{MECHANIC_ORDER.indexOf(id) + 1}</span>
              <span className="compendium-tab-name">{locked ? "???" : MECHANIC_LABEL[id]}</span>
            </button>
          );
        })}
      </div>

      {selectedLocked ? (
        <div className="compendium-detail">
          <div className="compendium-detail-preview">
            <div className="compendium-detail-locked">?</div>
          </div>
          <div className="compendium-detail-info">
            <div className="compendium-detail-locked-text">
              <div className="compendium-detail-name">Unknown mechanic</div>
              <p className="compendium-detail-desc">
                Encounter this mechanic in combat to unlock its dossier.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="compendium-detail">
          <div className="compendium-detail-preview">
            <MechanicPreview id={selected} size={360} />
          </div>
          <div className="compendium-detail-info">
            <div className="compendium-detail-head compendium-mech-head">
              <span className="compendium-mech-badge" aria-hidden>
                <MechanicIcon id={selected} size={56} />
              </span>
              <div>
                <div className="compendium-detail-name">{MECHANIC_LABEL[selected]}</div>
                <div className="compendium-detail-subtitle">{MECHANIC_SUBTITLE[selected]}</div>
              </div>
            </div>
            <p className="compendium-detail-desc">{MECHANIC_DESCRIPTION[selected]}</p>
            <dl className="compendium-stats compendium-mech-stats">
              {MECHANIC_STATS[selected].map(([label, val]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
