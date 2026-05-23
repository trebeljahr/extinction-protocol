import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGame } from "../store";

const SHOW_SEC = 5.4;

// Boss-wave banner — listens for boss-wave-start events and shows a
// dramatic top-of-screen alert for a few seconds. Cleared automatically
// or when a boss-defeated event lands (so wins close the banner if it
// somehow lingered through the wave).
export const BossBanner = () => {
  const { t } = useTranslation();
  const onEvent = useGame((s) => s.onEvent);
  const [wave, setWave] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onEvent((e) => {
      if (e.type === "boss-wave-start") {
        setWave(e.wave);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setWave(null), SHOW_SEC * 1000);
      } else if (e.type === "boss-defeated") {
        if (timer) clearTimeout(timer);
        setWave(null);
      } else if (e.type === "game-over") {
        if (timer) clearTimeout(timer);
        setWave(null);
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [onEvent]);

  if (wave === null) return null;
  return (
    <div className="boss-banner-overlay" aria-live="polite">
      <div className="boss-banner-card">
        <div className="boss-banner-eyebrow">{t("boss.eyebrow")}</div>
        <div className="boss-banner-title">{t("boss.title")}</div>
        <div className="boss-banner-sub">{t("boss.sub", { wave })}</div>
      </div>
    </div>
  );
};
