import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import { LEVELS } from "../levels";
import {
  DIFFICULTY_ACCENT,
  DIFFICULTY_LABEL,
  listSlots,
  type SlotId,
  type SlotInfo,
} from "../progress";
import { SaveSlotsScene } from "../render/SaveSlotsScene";
import { useGame } from "../store";
import { DifficultyModelIcon } from "./DifficultyModelIcon";
import { SettingsMenu } from "./SettingsMenu";

export const SaveSlots = () => {
  const selectSlot = useGame((s) => s.selectSlot);
  const deleteSlot = useGame((s) => s.deleteSlot);

  // listSlots() reads localStorage directly — bumping `revision` forces
  // a re-render after delete since the store doesn't mirror slot
  // metadata into reactive state (only the active slot's progress
  // lives in the store). 3 localStorage reads per render is cheap.
  const [revision, setRevision] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<SlotId | null>(null);

  void revision;
  const slots = listSlots();

  const totalLevels = LEVELS.length;

  const beginDelete = (id: SlotId) => setConfirmDeleteId(id);

  const confirmDelete = () => {
    if (confirmDeleteId === null) return;
    deleteSlot(confirmDeleteId);
    setConfirmDeleteId(null);
    setRevision((n) => n + 1);
  };

  return (
    <div className="save-slots-screen">
      <div className="save-slots-bg">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 5.5, 17], fov: 40, near: 0.1, far: 200 }}
        >
          <Suspense fallback={null}>
            <SaveSlotsScene />
          </Suspense>
        </Canvas>
      </div>

      <div className="save-slots-vignette" aria-hidden />

      <SettingsMenu />

      <header className="save-slots-title">
        <h1>Extinction Protocol</h1>
        <div className="save-slots-subtitle">Select a save</div>
      </header>

      <div className="save-slots-grid">
        {slots.map((slot) => (
          <SaveSlotTile
            key={slot.id}
            slot={slot}
            totalLevels={totalLevels}
            isConfirmingDelete={confirmDeleteId === slot.id}
            onSelect={() => selectSlot(slot.id)}
            onBeginDelete={() => beginDelete(slot.id)}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        ))}
      </div>
    </div>
  );
};

type TileProps = {
  slot: SlotInfo;
  totalLevels: number;
  isConfirmingDelete: boolean;
  onSelect: () => void;
  onBeginDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const SaveSlotTile = ({
  slot,
  totalLevels,
  isConfirmingDelete,
  onSelect,
  onBeginDelete,
  onConfirmDelete,
  onCancelDelete,
}: TileProps) => {
  const filled = slot.exists;
  return (
    <div className={`save-slot-tile ${filled ? "filled" : "empty"}`}>
      <div className="save-slot-tile-head">
        <div className="save-slot-id">SLOT {slot.id}</div>
        {filled && (
          <div
            className={`save-slot-difficulty ${DIFFICULTY_ACCENT[slot.progress.difficulty].text}`}
          >
            <DifficultyModelIcon
              difficulty={slot.progress.difficulty}
              className="w-4 h-4 shrink-0"
            />
            {DIFFICULTY_LABEL[slot.progress.difficulty].toUpperCase()}
          </div>
        )}
      </div>

      {isConfirmingDelete ? (
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
          ) : (
            <div className="save-slot-empty-text">No data yet — start a fresh campaign.</div>
          )}
          <div className="save-slot-actions">
            <button type="button" className="btn" onClick={onSelect}>
              {filled ? "Continue" : "Start"}
            </button>
            {filled && (
              <button type="button" className="btn btn-danger btn--sm" onClick={onBeginDelete}>
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
