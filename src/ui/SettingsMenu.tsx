import { useState } from "react";
import { isDebug } from "../debug";
import { DebugProgressSettings } from "./DebugProgressSettings";
import { FullscreenToggle } from "./FullscreenToggle";
import { IconCog } from "./MenuIcons";
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
        className="settings-menu-btn absolute top-4 right-4 z-30 bg-surface-1 border border-border rounded-md w-11 h-11 p-0 backdrop-blur-sm flex items-center justify-center pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        title="Settings"
        data-ui-sound="open"
      >
        <IconCog size={18} />
      </button>

      {open && (
        <MenuOverlay title="Settings" onClose={() => setOpen(false)}>
          <div className="menu-panel-scroll">
            <SoundControls />
            <FullscreenToggle />
            {isDebug && <DebugProgressSettings />}
          </div>
        </MenuOverlay>
      )}
    </>
  );
};
