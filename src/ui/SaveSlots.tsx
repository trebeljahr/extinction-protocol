import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { LEVELS } from "../levels";
import { listSlots, type SlotId, type SlotInfo } from "../progress";
import { useGame } from "../store";

const formatLastPlayed = (ts: number): string => {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const SaveSlots = () => {
  const selectSlot = useGame((s) => s.selectSlot);
  const renameSlot = useGame((s) => s.renameSlot);
  const deleteSlot = useGame((s) => s.deleteSlot);

  // listSlots() reads localStorage directly — bumping `revision` forces
  // a re-render after rename/delete since the store doesn't mirror slot
  // metadata into reactive state (only the active slot's progress
  // lives in the store). 3 localStorage reads per render is cheap.
  const [revision, setRevision] = useState(0);
  const [renamingId, setRenamingId] = useState<SlotId | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<SlotId | null>(null);

  // Reference revision so each bump invalidates this read; the call
  // is otherwise un-memoized and re-runs on every render anyway.
  void revision;
  const slots = listSlots();

  useEffect(() => {
    audio.ui("open");
  }, []);

  const totalLevels = LEVELS.length;

  const beginRename = (slot: SlotInfo) => {
    setRenamingId(slot.id);
    setRenameDraft(slot.meta.name);
    setConfirmDeleteId(null);
  };

  const submitRename = () => {
    if (renamingId === null) return;
    if (renameDraft.trim() === "") {
      setRenamingId(null);
      return;
    }
    renameSlot(renamingId, renameDraft);
    setRenamingId(null);
    setRevision((n) => n + 1);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const beginDelete = (id: SlotId) => {
    setConfirmDeleteId(id);
    setRenamingId(null);
  };

  const confirmDelete = () => {
    if (confirmDeleteId === null) return;
    deleteSlot(confirmDeleteId);
    setConfirmDeleteId(null);
    setRevision((n) => n + 1);
  };

  return (
    <div className="overlay save-slots-overlay">
      <div className="save-slots-card">
        <header className="save-slots-header">
          <h1>Select Save</h1>
          <div className="save-slots-subtitle">Three independent campaigns</div>
        </header>
        <div className="save-slots-grid">
          {slots.map((slot) => (
            <SaveSlotTile
              key={slot.id}
              slot={slot}
              totalLevels={totalLevels}
              isRenaming={renamingId === slot.id}
              isConfirmingDelete={confirmDeleteId === slot.id}
              renameDraft={renameDraft}
              onRenameDraft={setRenameDraft}
              onSelect={() => selectSlot(slot.id)}
              onBeginRename={() => beginRename(slot)}
              onSubmitRename={submitRename}
              onCancelRename={cancelRename}
              onBeginDelete={() => beginDelete(slot.id)}
              onConfirmDelete={confirmDelete}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

type TileProps = {
  slot: SlotInfo;
  totalLevels: number;
  isRenaming: boolean;
  isConfirmingDelete: boolean;
  renameDraft: string;
  onRenameDraft: (s: string) => void;
  onSelect: () => void;
  onBeginRename: () => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onBeginDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const SaveSlotTile = ({
  slot,
  totalLevels,
  isRenaming,
  isConfirmingDelete,
  renameDraft,
  onRenameDraft,
  onSelect,
  onBeginRename,
  onSubmitRename,
  onCancelRename,
  onBeginDelete,
  onConfirmDelete,
  onCancelDelete,
}: TileProps) => {
  const filled = slot.exists;
  return (
    <div className={`save-slot-tile ${filled ? "filled" : "empty"}`}>
      <div className="save-slot-id">SLOT {slot.id}</div>

      {isRenaming ? (
        <div className="save-slot-rename">
          <input
            type="text"
            // biome-ignore lint/a11y/noAutofocus: focused intentionally on entering rename mode
            autoFocus
            maxLength={24}
            value={renameDraft}
            onChange={(e) => onRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelRename();
              }
            }}
            aria-label="Slot name"
          />
          <div className="save-slot-row">
            <button type="button" className="btn btn--sm" onClick={onSubmitRename}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn--sm" onClick={onCancelRename}>
              Cancel
            </button>
          </div>
        </div>
      ) : isConfirmingDelete ? (
        <div className="save-slot-confirm">
          <div className="save-slot-confirm-text">Delete this save? This can't be undone.</div>
          <div className="save-slot-row">
            <button type="button" className="btn btn-danger btn--sm" onClick={onConfirmDelete}>
              Delete
            </button>
            <button type="button" className="btn btn-ghost btn--sm" onClick={onCancelDelete}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="save-slot-name">{filled ? slot.meta.name : "Empty"}</div>
          {filled ? (
            <>
              <div className="save-slot-stats">
                <div>
                  <span>Cleared</span>
                  <strong>
                    {slot.levelsCleared} / {totalLevels}
                  </strong>
                </div>
                <div>
                  <span>Stars</span>
                  <strong>{slot.totalStars}</strong>
                </div>
              </div>
              {slot.meta.lastPlayed > 0 && (
                <div className="save-slot-date">
                  Last played {formatLastPlayed(slot.meta.lastPlayed)}
                </div>
              )}
            </>
          ) : (
            <div className="save-slot-empty-text">No data yet — start a fresh campaign.</div>
          )}
          <div className="save-slot-actions">
            <button type="button" className="btn" onClick={onSelect}>
              {filled ? "Continue" : "Start"}
            </button>
            {filled && (
              <>
                <button type="button" className="btn btn-ghost btn--sm" onClick={onBeginRename}>
                  Rename
                </button>
                <button type="button" className="btn btn-danger btn--sm" onClick={onBeginDelete}>
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
