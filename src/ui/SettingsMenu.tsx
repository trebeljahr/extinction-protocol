import { useState } from "react";
import { FullscreenToggle } from "./FullscreenToggle";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";

// Floating top-right settings button + overlay shared by screens that
// don't have a full menu of their own (splash, save-slots). World-map
// and pause menus embed SoundControls/FullscreenToggle inline instead.
export const SettingsMenu = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="absolute top-4 right-4 z-30 bg-surface-1 border border-border rounded-md px-3 py-2 backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        title="Settings"
        data-ui-sound="open"
      >
        <span
          className="inline-flex flex-col justify-between w-[16px] h-[12px] [&>span]:block [&>span]:h-0.5 [&>span]:w-full [&>span]:bg-current [&>span]:rounded-[1px]"
          aria-hidden
        >
          <span />
          <span />
          <span />
        </span>
        <span className="text-xs font-bold tracking-wide uppercase">Settings</span>
      </button>

      {open && (
        <MenuOverlay title="Settings" onClose={() => setOpen(false)}>
          <div className="max-h-[75vh] overflow-y-auto pr-1 -mr-2">
            <SoundControls />
            <FullscreenToggle />
          </div>
        </MenuOverlay>
      )}
    </>
  );
};
