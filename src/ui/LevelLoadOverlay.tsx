// Covers the brief gap between clicking a level on the world map and
// the play scene having all of its shaders compiled. Replaces the bare
// black canvas flash that used to be visible while drei's Suspense was
// blocked on tower/dino GLBs and the GPU was compiling their materials.
//
// Visibility logic:
//  - Only shown while `screen === "playing"`.
//  - Hidden once the store's `assetsPrewarmed` flag flips true (set by
//    either the worldmap idle prewarm or the PlayScene ShaderPrewarm).
//  - When the worldmap prewarm finished before the click, the overlay
//    is skipped entirely (mount-time check on alreadyWarm), so the
//    transition is fully instantaneous.
//
// The progress bar reads from the global LoadingManager subscription
// in useLevelLoadProgress — it'll show network progress for any GLBs
// that weren't yet cached at click time. Pure decorative when those
// are all cache hits.
import { useEffect, useState } from "react";
import { useGame } from "../store";

const FADE_MS = 220;

export const LevelLoadOverlay = () => {
  const screen = useGame((s) => s.screen);
  const ready = useGame((s) => s.assetsPrewarmed);
  const progress = useGame((s) => s.levelLoadProgress);

  const [mounted, setMounted] = useState(() => screen === "playing" && !ready);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (screen === "playing" && !ready) {
      setMounted(true);
      setExiting(false);
    }
  }, [screen, ready]);

  useEffect(() => {
    if (!mounted) return;
    if (ready || screen !== "playing") {
      setExiting(true);
      const t = window.setTimeout(() => setMounted(false), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [ready, screen, mounted]);

  if (!mounted) return null;

  const pct = progress && progress.total > 0 ? (progress.loaded / progress.total) * 100 : null;

  return (
    <div className={`level-load-overlay ${exiting ? "level-load-overlay-exit" : ""}`}>
      <div className="level-load-card">
        <div className="level-load-eyebrow">Deploying Outpost</div>
        <div className="level-load-bar">
          <div
            className={`level-load-bar-fill ${pct === null ? "is-indeterminate" : ""}`}
            style={pct !== null ? { width: `${pct.toFixed(1)}%` } : undefined}
          />
        </div>
        <div className="level-load-status">
          {pct === null ? "compiling shaders…" : `loading assets… ${Math.round(pct)}%`}
        </div>
      </div>
    </div>
  );
};
