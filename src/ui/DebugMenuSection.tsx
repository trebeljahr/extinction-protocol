// Debug controls inside the in-run pause menu. Renders nothing in
// production because the parent gates on `isDebug` from src/debug.ts,
// and the gate collapses to `false` under `import.meta.env.DEV` so
// the whole component dead-codes out of the prod bundle.
//
// Lives next to PauseMenu.tsx rather than inside it because the JSX
// is non-trivial and bloats the menu file. State all lives on the
// store via the debug* actions.
import { EASTER_EGG_DEFS } from "../easterEggs";
import { useGame } from "../store";

const GOLD_BUMPS = [100, 500, 1000, 5000];

export const DebugMenuSection = () => {
  const freeTowers = useGame((s) => s.freeTowers);
  const status = useGame((s) => s.ui.status);
  const debugAddGold = useGame((s) => s.debugAddGold);
  const debugSkipWave = useGame((s) => s.debugSkipWave);
  const debugWinLevel = useGame((s) => s.debugWinLevel);
  const debugSetFreeTowers = useGame((s) => s.debugSetFreeTowers);
  const debugTriggerEasterEgg = useGame((s) => s.debugTriggerEasterEgg);

  const running = status === "running";

  return (
    <section className="bg-[rgba(255,214,106,0.05)] border border-[rgba(255,214,106,0.25)] rounded-lg pt-3.5 px-4 pb-3 mb-5">
      <div className="text-[10px] font-bold tracking-uber text-gold mb-2.5 flex items-center gap-2">
        <span>DEBUG · ?debug=true</span>
      </div>

      <DebugRow label="Wave">
        <button
          type="button"
          className="btn btn-ghost btn--sm"
          onClick={debugSkipWave}
          disabled={!running}
        >
          Skip wave
        </button>
        <button
          type="button"
          className="btn btn-ghost btn--sm"
          onClick={debugWinLevel}
          disabled={!running}
        >
          Win level
        </button>
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

      <DebugRow label="Towers">
        <button
          type="button"
          className={`btn btn--sm ${freeTowers ? "" : "btn-ghost"}`}
          onClick={() => debugSetFreeTowers(!freeTowers)}
          aria-pressed={freeTowers}
        >
          {freeTowers ? "Free towers: on" : "Free towers: off"}
        </button>
      </DebugRow>

      <DebugRow label="Eggs">
        {EASTER_EGG_DEFS.map((d) => (
          <button
            key={d.id}
            type="button"
            className="btn btn-ghost btn--sm"
            title={d.motion ? "Spawn moving egg from edge" : "Drop static egg at map center"}
            onClick={() => debugTriggerEasterEgg(d.id)}
          >
            {d.id}
          </button>
        ))}
      </DebugRow>
    </section>
  );
};

const DebugRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 my-1.5 flex-wrap">
    <span className="w-16 text-xs tracking-[0.06em] text-fg-muted">{label}</span>
    <div className="flex gap-1.5 flex-wrap flex-1">{children}</div>
  </div>
);
