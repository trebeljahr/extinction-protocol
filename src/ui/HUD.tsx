import { useEffect } from "react";
import { useGame } from "../store";

export const HUD = () => {
  const ui = useGame(s => s.ui);
  const reset = useGame(s => s.reset);
  const togglePause = useGame(s => s.togglePause);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "KeyR") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, reset]);

  return (
    <div className="hud">
      <div className="hud-top">
        <Stat label="GOLD" value={ui.gold} accent="#ffd66a" />
        <Stat label="LIVES" value={ui.lives} accent="#ff5a7a" />
        <Stat label="WAVE" value={`${ui.wave} / ${ui.totalWaves}`} accent="#9fd8ff" />
        <Stat
          label={ui.waveActive ? "WAVE" : "NEXT"}
          value={ui.waveActive ? "ACTIVE" : `${ui.nextWaveIn}s`}
          accent="#b4ffc9"
        />
      </div>

      <div className="hud-bottom">
        <span>Click empty tile to place a Pulse Rifle (50g)</span>
        <span className="sep">·</span>
        <span>Space: pause</span>
        <span className="sep">·</span>
        <span>R: restart</span>
      </div>

      {ui.status !== "running" && (
        <div className="overlay">
          <div className="overlay-card">
            <h1>
              {ui.status === "won" && "Outpost held."}
              {ui.status === "lost" && "Extinction complete."}
              {ui.status === "paused" && "Paused"}
            </h1>
            {ui.status !== "paused" && (
              <button onClick={reset} className="btn">Run it back (R)</button>
            )}
            {ui.status === "paused" && (
              <button onClick={togglePause} className="btn">Resume (Space)</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className="stat">
    <div className="stat-label" style={{ color: accent }}>{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);
