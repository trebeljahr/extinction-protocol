import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_BRIEFING, LEVEL_INTERSTITIAL } from "../levels/briefings";
import { useGame } from "../store";
import { useInputMode } from "./useInputMode";

const FADE_MS = 220;

export const LevelIntro = () => {
  const levelId = useGame((s) => s.selectedLevelId);
  const dismiss = useGame((s) => s.dismissLevelIntro);
  const [exiting, setExiting] = useState(false);
  const input = useInputMode();

  const exitingRef = useRef(false);
  const aliveRef = useRef(true);

  const briefing = levelId !== null ? LEVEL_BRIEFING[levelId] : undefined;
  const commandNote = levelId !== null ? LEVEL_INTERSTITIAL[levelId] : undefined;

  const beginDefense = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    setTimeout(() => {
      if (aliveRef.current) dismiss();
    }, FADE_MS);
  }, [dismiss]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Dismiss only on an explicit signal: any key (gamepad confirm arrives
  // as a synthetic keydown), or a tap on the backdrop outside the card.
  // Taps and scroll gestures *on* the card never dismiss — otherwise the
  // first touch a player makes to scroll a long briefing would skip it.
  // The "Begin defense" button starts the level from the card itself. A
  // scroll gesture does not fire `click`, so dragging to read is safe.
  useEffect(() => {
    if (!briefing) return;

    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      beginDefense();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".quick-settings")) return;
      if (target?.closest(".level-intro-card")) return;
      beginDefense();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [briefing, beginDefense]);

  if (!briefing) return null;

  const hint =
    input.mode === "gamepad"
      ? "press a button to begin"
      : input.mode === "keyboard" && !input.touchPrimary
        ? "press any key, or tap outside, to begin"
        : commandNote
          ? "scroll to read · tap Begin to start"
          : "tap Begin, or tap outside, to start";

  return (
    <div className={`level-intro-overlay ${exiting ? "level-intro-exit" : ""}`}>
      <div className="level-intro-card">
        <div className="level-intro-eyebrow">Field Report · Outpost {levelId}</div>
        <p className="level-intro-text">{briefing}</p>
        {commandNote && (
          <div className="level-intro-command-note">
            <div className="level-intro-command-note-eyebrow">Command Update</div>
            <p className="level-intro-command-note-text">{commandNote}</p>
          </div>
        )}
        <button
          type="button"
          className="level-intro-begin"
          onClick={(e) => {
            e.stopPropagation();
            beginDefense();
          }}
        >
          Begin defense
        </button>
        <div className="level-intro-hint">{hint}</div>
      </div>
    </div>
  );
};
