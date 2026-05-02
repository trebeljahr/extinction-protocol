import { useEffect } from "react";
import { ACHIEVEMENT_BY_ID } from "../achievements";
import { audio } from "../audio/AudioManager";
import { useGame } from "../store";

const TOAST_LIFETIME_MS = 5000;

export const AchievementToast = () => {
  const toasts = useGame((s) => s.achievementToasts);
  const dismiss = useGame((s) => s.dismissAchievementToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.key), TOAST_LIFETIME_MS));
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [toasts, dismiss]);

  useEffect(() => {
    if (toasts.length === 0) return;
    audio.play("star", "notifications", 0.7, 120, 1.4);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div className="achievement-toast-stack">
      {toasts.map((t) => {
        const def = ACHIEVEMENT_BY_ID[t.id];
        const Icon = def.icon;
        return (
          <button
            type="button"
            key={t.key}
            className="achievement-toast"
            onClick={() => dismiss(t.key)}
            title="Dismiss"
          >
            <div className="achievement-toast-icon">
              <Icon size={40} />
            </div>
            <div className="achievement-toast-text">
              <div className="achievement-toast-label">ACHIEVEMENT UNLOCKED</div>
              <div className="achievement-toast-name">{def.name}</div>
              <div className="achievement-toast-desc">{def.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
