import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { useGame } from "../store";

const MIN_DISPLAY_MS = 1200;
// Hard cap so a hung audio fetch never strands the user on the splash.
// Real fetches finish in well under a second on any reasonable network;
// 6s is generous for slow mobile.
const MAX_DISPLAY_MS = 6000;
const FADE_MS = 220;

export const Splash = () => {
  const dismissSplash = useGame((s) => s.dismissSplash);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let cancelled = false;
    let dismissed = false;

    const dismiss = () => {
      if (cancelled || dismissed) return;
      dismissed = true;
      setExiting(true);
      window.setTimeout(() => {
        if (cancelled) return;
        dismissSplash();
      }, FADE_MS);
    };

    const finishWhenReady = (ready: boolean) => {
      if (cancelled || dismissed) return;
      const elapsed = performance.now() - start;
      const remaining = ready ? Math.max(0, MIN_DISPLAY_MS - elapsed) : MIN_DISPLAY_MS;
      window.setTimeout(() => {
        if (!cancelled && !dismissed) dismiss();
      }, remaining);
    };

    // Audio preload is the only real "asset pipeline" we await — 3D
    // scenes lazy-load on demand. Preload is idempotent (samples cache
    // by key), so re-triggering it from useAudioBridge later is cheap.
    let assetsReady = false;
    audio
      .preload()
      .then(() => {
        assetsReady = true;
        finishWhenReady(true);
      })
      .catch(() => {
        assetsReady = true;
        finishWhenReady(true);
      });

    // If preload happens to finish before MIN_DISPLAY_MS, the call
    // above schedules dismissal. If it's slower, MIN_DISPLAY_MS still
    // expires first — we just sit on the splash until preload settles
    // OR the absolute cap fires.
    const minTimer = window.setTimeout(() => {
      if (!cancelled && !dismissed && assetsReady) dismiss();
    }, MIN_DISPLAY_MS);

    const maxTimer = window.setTimeout(() => {
      if (!cancelled && !dismissed) dismiss();
    }, MAX_DISPLAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [dismissSplash]);

  return (
    <div className={`splash ${exiting ? "splash-exit" : ""}`}>
      <div className="splash-card">
        <div className="splash-mark" aria-hidden>
          <img src="/icons/icon.png" alt="" />
        </div>
        <h1 className="splash-title">Extinction Protocol</h1>
        <div className="splash-subtitle">Defense Network · Initializing</div>
        <div className="splash-bar" aria-hidden>
          <div className="splash-bar-fill" />
        </div>
      </div>
    </div>
  );
};
