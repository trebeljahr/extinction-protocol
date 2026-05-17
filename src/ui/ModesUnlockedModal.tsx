import { LEVEL_MODE_LABEL, LEVEL_MODE_TAGLINE } from "../progress";
import { useGame } from "../store";
import { MenuOverlay } from "./MenuOverlay";

const MODE_ACCENT = {
  heroic: { text: "text-orange", border: "border-orange", tint: "bg-[rgba(255,178,102,0.10)]" },
  iron: { text: "text-red", border: "border-red", tint: "bg-tint-red" },
} as const;

const MODE_ICON = { heroic: "✦", iron: "▣" } as const;

const MODE_DETAIL: Record<"heroic" | "iron", string> = {
  heroic:
    "Tougher waves and a denied tower slot. Pick from the level's mode menu — clearing earns a bonus star.",
  iron: "One life. A locked loadout. No selling. The campaign's hardest variant — clearing earns a bonus star.",
};

export const ModesUnlockedModal = () => {
  const dismiss = useGame((s) => s.dismissModesUnlockedExplainer);

  return (
    <MenuOverlay
      title="Challenge Modes Unlocked"
      subtitle="Three stars cleared — new ways to play"
      onClose={dismiss}
      closeLabel="Got it"
      cardClassName="!max-w-[640px]"
    >
      <p className="text-[13px] leading-snug text-fg-muted mb-4">
        Three-starring a level now unlocks two new modes for it. Pick them from a level's mode menu
        on the world map. Each mode beaten adds one bonus star to the level, up to a max of 5.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["heroic", "iron"] as const).map((mode) => {
          const accent = MODE_ACCENT[mode];
          return (
            <div
              key={mode}
              className={`relative flex flex-col gap-2 p-4 rounded-lg border bg-surface-1 ${accent.border} ${accent.tint}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${accent.text}`} aria-hidden>
                  {MODE_ICON[mode]}
                </span>
                <span className={`text-base font-bold ${accent.text} tracking-mid`}>
                  {LEVEL_MODE_LABEL[mode]}
                </span>
              </div>
              <div className="text-[11px] text-fg-muted leading-snug italic">
                {LEVEL_MODE_TAGLINE[mode]}
              </div>
              <p className="text-[12px] leading-snug text-fg">{MODE_DETAIL[mode]}</p>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end mt-5">
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          Got it
        </button>
      </div>
    </MenuOverlay>
  );
};
