import { clamp01 } from "../sim/vec2";
import { useGame } from "../store";
import { RobotPreview } from "./RobotPreview";

// Top-left "banner" — clicking it toggles the robot overview overlay
// (stats / abilities / vitals). Robot selection for in-canvas commands
// (move, target) is a separate action via the robot mesh or hotkey "1".
export const RobotMiniIcon = () => {
  const variant = useGame((s) => s.ui.robotVariant);
  const hp = useGame((s) => s.ui.robotHp);
  const maxHp = useGame((s) => s.ui.robotMaxHp);
  const alive = useGame((s) => s.ui.robotAlive);
  const respawnRemaining = useGame((s) => s.ui.robotRespawnRemaining);
  const level = useGame((s) => s.ui.robotLevel);
  const status = useGame((s) => s.ui.status);
  const panelOpen = useGame((s) => s.robotPanelOpen);
  const setRobotPanelOpen = useGame((s) => s.setRobotPanelOpen);

  if (status !== "running" && status !== "paused") return null;

  const hpPct = maxHp > 0 ? clamp01(hp / maxHp) : 0;

  return (
    <button
      type="button"
      className={`robot-mini ${alive ? "" : "dead"} ${panelOpen ? "active" : ""}`}
      onClick={() => setRobotPanelOpen(!panelOpen)}
      title={alive ? `Robot overview · ${hp}/${maxHp} HP` : `Respawn in ${respawnRemaining}s`}
      aria-label="Toggle robot overview"
      aria-pressed={panelOpen}
    >
      <RobotPreview variant={variant} />
      <div className="robot-mini-body">
        <div className="robot-mini-row">
          <span className="robot-mini-label">ROBOT</span>
          <span className="robot-mini-lvl">Lv {level}</span>
        </div>
        <div className="robot-mini-bar">
          <div className="robot-mini-bar-fill" style={{ width: `${hpPct * 100}%` }} />
        </div>
        <div className="robot-mini-hp">
          {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
        </div>
      </div>
    </button>
  );
};
