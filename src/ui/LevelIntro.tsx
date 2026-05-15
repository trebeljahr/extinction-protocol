import { useEffect, useState } from "react";
import { LEVEL_BRIEFING } from "../levels/briefings";
import { useGame } from "../store";
import { useInputMode } from "./useInputMode";

const FADE_MS = 220;

export const LevelIntro = () => {
  const levelId = useGame((s) => s.selectedLevelId);
  const dismiss = useGame((s) => s.dismissLevelIntro);
  const [exiting, setExiting] = useState(false);
  const input = useInputMode();

  const briefing = levelId !== null ? LEVEL_BRIEFING[levelId] : undefined;
  const hint =
    input.mode === "gamepad"
      ? "press a button to continue"
      : input.mode === "keyboard" && !input.touchPrimary
        ? "press any key to continue"
        : "tap to continue";

  useEffect(() => {
    if (!briefing) return;
    let cancelled = false;

    const fadeOut = () => {
      if (cancelled) return;
      setExiting(true);
      setTimeout(() => {
        if (!cancelled) dismiss();
      }, FADE_MS);
    };

    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      fadeOut();
    };
    const onClick = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".quick-settings")) return;
      fadeOut();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onClick, true);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onClick, true);
    };
  }, [briefing, dismiss]);

  if (!briefing) return null;

  return (
    <div className={`level-intro-overlay ${exiting ? "level-intro-exit" : ""}`}>
      <div className="level-intro-card">
        <div className="level-intro-eyebrow">Field Report · Outpost {levelId}</div>
        <p className="level-intro-text">{briefing}</p>
        <div className="level-intro-hint">{hint}</div>
      </div>
    </div>
  );
};
