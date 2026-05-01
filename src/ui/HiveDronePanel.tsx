import type { Tower } from "../sim/types";
import { TOWER_LABEL } from "../sim/world";
import { useGame } from "../store";

// Per-drone slot list inside the Hive tower panel. Each slot shows the
// current assignment ("idle" or the target tower's name) and a button
// to either start picking a target or clear the slot. The pick action
// arms the global assigningDroneSlot cursor; the actual target is
// captured by the world-click handler in store.ts → tryPlaceOrSelect.
type Props = { hive: Tower };

export const HiveDronePanel = ({ hive }: Props) => {
  // Subscribe to the assignment cursor so the slot button highlights
  // the slot currently being targeted. Subscribing to towerVersion as
  // well isn't needed — re-renders flow from the parent panel.
  const assigning = useGame((s) => s.assigningDroneSlot);
  const towers = useGame.getState().world.towers;
  const begin = useGame((s) => s.beginDroneAssignment);
  const cancel = useGame((s) => s.cancelDroneAssignment);
  const clear = useGame((s) => s.clearDroneAssignment);

  // Tower name for an assignment id, or null when idle/stale.
  const towerName = (id: number | null): string | null => {
    if (id === null) return null;
    const t = towers.find((tw) => tw.id === id);
    if (!t) return null;
    return TOWER_LABEL[t.kind];
  };

  // Pre-compute slot data so the JSX below doesn't expose the array
  // index to the linter — slot identity is stable (idx is the drone's
  // permanent ID within this hive) and pairing it with hive.id gives
  // a globally unique React key.
  type Slot = {
    key: string;
    droneIdx: number;
    targetName: string | null;
    isPicking: boolean;
  };
  const slots: Slot[] = [];
  for (let i = 0; i < hive.droneCount; i++) {
    slots.push({
      key: `${hive.id}-${i}`,
      droneIdx: i,
      targetName: towerName(hive.droneAssignments[i]),
      isPicking: assigning?.hiveId === hive.id && assigning?.droneIdx === i,
    });
  }

  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold tracking-wide text-fg-muted uppercase mb-1.5">
        Drone slots
      </div>
      <div className="flex flex-col gap-1">
        {slots.map((slot) => {
          const status = slot.targetName ? `→ ${slot.targetName}` : "Idle";
          const statusColor = slot.targetName ? "#bbffc8" : "var(--color-fg-muted)";
          return (
            <div
              key={slot.key}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] border border-border-faint bg-surface-faint"
            >
              <span className="text-[10px] font-bold tracking-wide text-fg-muted w-12">
                Drone {slot.droneIdx + 1}
              </span>
              <span
                className="text-[12px] flex-1 tabular-nums truncate"
                style={{ color: statusColor }}
              >
                {status}
              </span>
              {slot.isPicking ? (
                <button
                  type="button"
                  className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-[4px] border"
                  style={{
                    color: "#ffb030",
                    borderColor: "rgba(255,176,48,0.5)",
                    background: "rgba(255,176,48,0.10)",
                  }}
                  onClick={cancel}
                  title="Cancel pick — click the map or press Esc"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-[4px] border border-border-faint hover:border-fg"
                  onClick={() => begin(hive.id, slot.droneIdx)}
                  title="Click a tower on the map to assign"
                >
                  Pick
                </button>
              )}
              {slot.targetName && !slot.isPicking && (
                <button
                  type="button"
                  className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-[4px] border border-border-faint hover:border-fg"
                  onClick={() => clear(hive.id, slot.droneIdx)}
                  title="Send this drone home"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {assigning?.hiveId === hive.id && (
        <div
          className="mt-2 text-[10px] tracking-wide uppercase font-bold px-2 py-1.5 rounded-[4px] border"
          style={{
            color: "#ffb030",
            borderColor: "rgba(255,176,48,0.5)",
            background: "rgba(255,176,48,0.10)",
          }}
        >
          Click a tower to assign Drone {assigning.droneIdx + 1} · click empty ground to cancel
        </div>
      )}
    </div>
  );
};
