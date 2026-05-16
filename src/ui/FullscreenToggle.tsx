import { IconFullscreen, IconFullscreenExit } from "./MenuIcons";
import { saveFullscreenPref, useFullscreen } from "./useFullscreen";

export const FullscreenToggle = () => {
  const { active, toggle } = useFullscreen();
  return (
    <section className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg pt-3 px-4 pb-3 mb-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-uber text-gold">
          {active ? (
            <IconFullscreenExit size={14} className="shrink-0" />
          ) : (
            <IconFullscreen size={14} className="shrink-0" />
          )}
          FULLSCREEN
        </div>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-[5px] border text-[10px] font-bold tracking-uber font-[inherit] cursor-pointer ${
            active
              ? "bg-[rgba(61,209,255,0.12)] border-[rgba(61,209,255,0.4)] text-cyan"
              : "bg-tint-pink border-[rgba(255,122,154,0.45)] text-pink"
          }`}
          onClick={() => {
            // Manual toggle locks the preference — once the user picks
            // a side, we stop auto-entering on level start.
            saveFullscreenPref(active ? "off" : "on");
            void toggle();
          }}
          aria-pressed={active}
        >
          {active ? "ON" : "OFF"}
        </button>
      </div>
    </section>
  );
};
