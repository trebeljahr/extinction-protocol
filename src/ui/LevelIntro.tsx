import { useEffect, useState } from "react";
import { LEVEL_BRIEFING } from "../levels/briefings";
import { useGame } from "../store";

const FADE_MS = 220;

export const LevelIntro = () => {
  const levelId = useGame((s) => s.selectedLevelId);
  const dismiss = useGame((s) => s.dismissLevelIntro);
  const [exiting, setExiting] = useState(false);

  const briefing = levelId !== null ? LEVEL_BRIEFING[levelId] : undefined;

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
    const onClick = () => fadeOut();

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
        <div className="level-intro-hint">press any key to continue</div>
      </div>
    </div>
  );
};
