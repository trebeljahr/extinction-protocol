// Debug controls used by both the in-run pause menu and the world-map
// menu. Renders nothing in production because every call site gates on
// `isDebug` from src/debug.ts, which collapses to `false` under
// `import.meta.env.DEV` so the whole component dead-codes out of the
// prod bundle.
//
// State all lives on the store via the debug* actions. Sections that
// only make sense mid-level (gold, wave control, spawn) self-hide based
// on the live `screen`/`status` so the same component is safe to drop
// into the world-map menu.
import { useState } from "react";
import { ACHIEVEMENTS, isAchievementUnlocked } from "../achievements";
import { fetchPlannerTrace } from "../debugPlannerTrace";
import { EASTER_EGG_DEFS } from "../easterEggs";
import { hasEncountered } from "../progress";
import { MECHANIC_LABEL, MECHANIC_ORDER, type MechanicId } from "../sim/mechanicsText";
import type { EnemyKind, TowerKind } from "../sim/types";
import { ENEMY_LABEL, TOWER_LABEL } from "../sim/world";
import { useGame } from "../store";

const GOLD_BUMPS = [100, 500, 1000, 5000];

// Enemy + tower orders mirror the compendium so the lock toggles read
// in the same sequence as the tabs being inspected.
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

export const DebugMenuSection = () => {
  return (
    <section className="debug-menu-section bg-[rgba(255,214,106,0.05)] border border-[rgba(255,214,106,0.25)] rounded-lg pt-3.5 px-4 pb-3 mb-5">
      <div className="text-[10px] font-bold tracking-uber text-gold mb-2.5 flex items-center gap-2">
        <span>DEBUG · ?debug=true</span>
      </div>

      <RunControls />
      <CompendiumLockControls />
      <AchievementControls />
      <EasterEggControls />
    </section>
  );
};

// --- In-run controls ------------------------------------------------------
//
// Self-hides when not in a live run. The pause menu is the obvious host;
// the world-map menu mounts the same component but skips this block since
// `screen !== "playing"`.

const RunControls = () => {
  const screen = useGame((s) => s.screen);
  const status = useGame((s) => s.ui.status);
  const wave = useGame((s) => s.ui.wave);
  const totalWaves = useGame((s) => s.ui.totalWaves);
  const levelId = useGame((s) => s.world.levelId);
  const difficulty = useGame((s) => s.progress.difficulty);
  const freeTowers = useGame((s) => s.freeTowers);
  const invincible = useGame((s) => s.invincible);
  const pathDebug = useGame((s) => s.pathDebug);
  const debugAddGold = useGame((s) => s.debugAddGold);
  const debugSkipWave = useGame((s) => s.debugSkipWave);
  const debugWinLevel = useGame((s) => s.debugWinLevel);
  const debugForceWave = useGame((s) => s.debugForceWave);
  const debugSetFreeTowers = useGame((s) => s.debugSetFreeTowers);
  const debugSetInvincible = useGame((s) => s.debugSetInvincible);
  const debugSetPathDebug = useGame((s) => s.debugSetPathDebug);
  const debugSpawnEnemy = useGame((s) => s.debugSpawnEnemy);
  const debugLoadSuggestedBuild = useGame((s) => s.debugLoadSuggestedBuild);
  const [planLoad, setPlanLoad] = useState<"idle" | "loading" | "loaded" | "missing" | "error">(
    "idle",
  );

  const loadSuggestedBuild = async () => {
    setPlanLoad("loading");
    try {
      const trace = await fetchPlannerTrace(levelId, difficulty);
      if (!trace) {
        setPlanLoad("missing");
        return;
      }
      debugLoadSuggestedBuild(trace);
      setPlanLoad("loaded");
    } catch {
      setPlanLoad("error");
    }
  };

  if (screen !== "playing") {
    // pathDebug + invincibility are still useful between runs, but the
    // sim-driven actions below would be no-ops. Surface only the toggles
    // that survive the no-world case.
    return (
      <DebugSubsection title="Run">
        <DebugRow label="Toggles">
          <Toggle on={invincible} onClick={() => debugSetInvincible(!invincible)}>
            {invincible ? "Invincible: on" : "Invincible: off"}
          </Toggle>
          <Toggle on={pathDebug} onClick={() => debugSetPathDebug(!pathDebug)}>
            {pathDebug ? "Path debug: on" : "Path debug: off"}
          </Toggle>
        </DebugRow>
      </DebugSubsection>
    );
  }

  // Wave selector — only renders force buttons up to the level's total.
  const waveOptions: number[] = [];
  for (let i = 1; i <= totalWaves; i++) waveOptions.push(i);

  return (
    <DebugSubsection title="Run">
      <DebugRow label="Wave">
        <button type="button" className="btn btn-ghost btn--sm" onClick={debugSkipWave}>
          Skip wave
        </button>
        <button type="button" className="btn btn-ghost btn--sm" onClick={debugWinLevel}>
          Win level
        </button>
        <span className="text-[10px] tracking-wide text-fg-faint uppercase ml-1">
          {wave}/{totalWaves}
        </span>
      </DebugRow>

      <DebugRow label="Force">
        <div className="flex gap-1 flex-wrap">
          {waveOptions.map((n) => (
            <button
              key={n}
              type="button"
              className={`btn btn--sm ${wave === n && status !== "won" ? "" : "btn-ghost"}`}
              onClick={() => debugForceWave(n)}
              title={`Jump to wave ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      </DebugRow>

      <DebugRow label="Gold">
        {GOLD_BUMPS.map((n) => (
          <button
            key={n}
            type="button"
            className="btn btn-ghost btn--sm"
            onClick={() => debugAddGold(n)}
          >
            +{n}
          </button>
        ))}
      </DebugRow>

      <DebugRow label="Spawn">
        {ENEMY_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            className="btn btn-ghost btn--sm"
            onClick={() => debugSpawnEnemy(kind)}
            title={`Spawn one ${ENEMY_LABEL[kind]} on path 0`}
          >
            {ENEMY_LABEL[kind]}
          </button>
        ))}
      </DebugRow>

      <DebugRow label="Toggles">
        <Toggle on={freeTowers} onClick={() => debugSetFreeTowers(!freeTowers)}>
          {freeTowers ? "Free towers: on" : "Free towers: off"}
        </Toggle>
        <Toggle on={invincible} onClick={() => debugSetInvincible(!invincible)}>
          {invincible ? "Invincible: on" : "Invincible: off"}
        </Toggle>
        <Toggle on={pathDebug} onClick={() => debugSetPathDebug(!pathDebug)}>
          {pathDebug ? "Path debug: on" : "Path debug: off"}
        </Toggle>
      </DebugRow>

      <DebugRow label="Plan">
        <button
          type="button"
          className="btn btn-ghost btn--sm"
          onClick={loadSuggestedBuild}
          disabled={planLoad === "loading"}
          title={`Load suggested lab and robot upgrades for level ${levelId} (${difficulty})`}
        >
          {planLoad === "loading" ? "Loading..." : "Load labs + robot"}
        </button>
        {planLoad !== "idle" && planLoad !== "loading" && (
          <span className="text-[10px] tracking-wide text-fg-faint uppercase ml-1">
            {planLoad === "loaded" ? "loaded" : planLoad === "missing" ? "no trace" : "error"}
          </span>
        )}
      </DebugRow>
    </DebugSubsection>
  );
};

// --- Compendium locks -----------------------------------------------------
//
// Enemies route through `progress.encountered` so the production compendium
// rendering picks them up unchanged. Towers + mechanics have no production
// lock concept, so the toggles flip a debug-only override on the store
// that the compendium reads to render their locked state.

const CompendiumLockControls = () => {
  const progress = useGame((s) => s.progress);
  const towerLocks = useGame((s) => s.compendiumLocks.towers);
  const mechLocks = useGame((s) => s.compendiumLocks.mechanics);
  const debugSetEnemyEncountered = useGame((s) => s.debugSetEnemyEncountered);
  const debugSetTowerLocked = useGame((s) => s.debugSetTowerLocked);
  const debugSetMechanicLocked = useGame((s) => s.debugSetMechanicLocked);

  return (
    <DebugSubsection title="Compendium">
      <ChipGrid>
        {ENEMY_ORDER.map((kind) => {
          const seen = hasEncountered(progress, kind);
          return (
            <LockChip
              key={kind}
              locked={!seen}
              label={ENEMY_LABEL[kind]}
              onToggle={() => debugSetEnemyEncountered(kind, !seen)}
              kindLabel="enemy"
            />
          );
        })}
        {TOWER_ORDER.map((kind) => {
          const locked = towerLocks[kind] === true;
          return (
            <LockChip
              key={kind}
              locked={locked}
              label={TOWER_LABEL[kind]}
              onToggle={() => debugSetTowerLocked(kind, !locked)}
              kindLabel="tower"
            />
          );
        })}
        {MECHANIC_ORDER.map((id: MechanicId) => {
          const locked = mechLocks[id] === true;
          return (
            <LockChip
              key={id}
              locked={locked}
              label={MECHANIC_LABEL[id]}
              onToggle={() => debugSetMechanicLocked(id, !locked)}
              kindLabel="mechanic"
            />
          );
        })}
      </ChipGrid>
    </DebugSubsection>
  );
};

// --- Achievements ---------------------------------------------------------

const AchievementControls = () => {
  const progress = useGame((s) => s.progress);
  const debugSetAchievementUnlocked = useGame((s) => s.debugSetAchievementUnlocked);

  return (
    <DebugSubsection title="Achievements">
      <ChipGrid>
        {ACHIEVEMENTS.map((a) => {
          const unlocked = isAchievementUnlocked(progress, a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`text-[10px] font-bold tracking-wide uppercase rounded px-2 py-1 leading-tight transition-colors ${
                unlocked
                  ? "bg-gold text-black"
                  : "bg-[rgba(255,255,255,0.04)] text-fg-muted hover:bg-[rgba(255,255,255,0.1)]"
              }`}
              onClick={() => debugSetAchievementUnlocked(a.id, !unlocked)}
              title={`${a.name} — ${a.desc}`}
              aria-pressed={unlocked}
            >
              {a.name}
            </button>
          );
        })}
      </ChipGrid>
    </DebugSubsection>
  );
};

// --- Easter eggs ----------------------------------------------------------

const EasterEggControls = () => {
  const screen = useGame((s) => s.screen);
  const progress = useGame((s) => s.progress);
  const debugTriggerEasterEgg = useGame((s) => s.debugTriggerEasterEgg);
  const debugForceUnlockEasterEggAchievement = useGame(
    (s) => s.debugForceUnlockEasterEggAchievement,
  );
  const inGame = screen === "playing";

  return (
    <DebugSubsection title="Eggs">
      <ChipGrid>
        {EASTER_EGG_DEFS.map((d) => {
          const unlocked = progress.unlocked[d.achievement] !== undefined;
          return (
            <div key={d.id} className="flex items-center gap-1">
              <button
                type="button"
                className={`text-[10px] font-bold tracking-wide uppercase rounded-l px-2 py-1 leading-tight transition-colors ${
                  unlocked
                    ? "bg-gold text-black"
                    : "bg-[rgba(255,255,255,0.04)] text-fg-muted hover:bg-[rgba(255,255,255,0.1)]"
                }`}
                onClick={() => debugForceUnlockEasterEggAchievement(d.id)}
                disabled={unlocked}
                title={
                  unlocked
                    ? "Already unlocked"
                    : `Force-unlock ${d.achievement} achievement directly`
                }
                aria-pressed={unlocked}
              >
                {d.id}
              </button>
              <button
                type="button"
                className="text-[10px] font-bold tracking-wide uppercase rounded-r px-2 py-1 leading-tight bg-[rgba(255,255,255,0.04)] text-fg-muted hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => debugTriggerEasterEgg(d.id)}
                disabled={!inGame}
                title={
                  inGame
                    ? d.motion
                      ? "Spawn moving egg from edge"
                      : "Drop static egg at map center"
                    : "Spawn requires an active level"
                }
              >
                spawn
              </button>
            </div>
          );
        })}
      </ChipGrid>
    </DebugSubsection>
  );
};

// --- Layout primitives ----------------------------------------------------

const DebugSubsection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-3 first:mt-0 pt-2 first:pt-0 border-t first:border-t-0 border-[rgba(255,214,106,0.15)]">
    <div className="text-[9px] font-bold tracking-[0.18em] text-gold/80 uppercase mb-1.5">
      {title}
    </div>
    {children}
  </div>
);

const DebugRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 my-1.5 flex-wrap">
    <span className="w-16 text-xs tracking-[0.06em] text-fg-muted">{label}</span>
    <div className="flex gap-1.5 flex-wrap flex-1 items-center">{children}</div>
  </div>
);

const ChipGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="debug-chip-grid flex flex-wrap gap-1 max-h-[40vh] overflow-y-auto pr-1">
    {children}
  </div>
);

const Toggle = ({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    className={`btn btn--sm ${on ? "" : "btn-ghost"}`}
    onClick={onClick}
    aria-pressed={on}
  >
    {children}
  </button>
);

const LockChip = ({
  locked,
  label,
  onToggle,
  kindLabel,
}: {
  locked: boolean;
  label: string;
  onToggle: () => void;
  kindLabel: string;
}) => (
  <button
    type="button"
    className={`text-[10px] font-bold tracking-wide uppercase rounded px-2 py-1 leading-tight transition-colors ${
      locked
        ? "bg-[rgba(255,255,255,0.04)] text-fg-faint hover:bg-[rgba(255,255,255,0.1)]"
        : "bg-gold text-black"
    }`}
    onClick={onToggle}
    title={`${kindLabel}: ${label} — ${locked ? "locked (click to unlock)" : "unlocked (click to lock)"}`}
    aria-pressed={!locked}
  >
    {locked ? `[locked] ${label}` : label}
  </button>
);
