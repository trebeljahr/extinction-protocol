import { useGame } from "../store";
import { MenuOverlay } from "./MenuOverlay";

// One-shot reveal shown on the world map the first time the player has
// cleared the final campaign outpost. Mirrors ModesUnlockedModal; the
// dismissed flag is persisted so it never reappears on this slot.
export const EndlessUnlockedModal = () => {
  const dismiss = useGame((s) => s.dismissEndlessUnlockExplainer);

  return (
    <MenuOverlay
      title="Endless Mode Unlocked"
      subtitle="Final outpost held — now survive as long as you can"
      onClose={dismiss}
      closeLabel="Got it"
      cardClassName="!max-w-[560px]"
    >
      <p className="text-[13px] leading-snug text-fg-muted mb-4">
        With the campaign's last outpost secured, the Endless protocol is live. Pick a dedicated
        arena and hold the line against waves that never stop and only escalate — more enemies,
        tougher hides, faster packs, and a matriarch every five waves. There is no win condition;
        the run ends when your lives run out. Your best wave per arena is saved locally.
      </p>
      <div className="flex justify-end mt-5">
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          Got it
        </button>
      </div>
    </MenuOverlay>
  );
};
