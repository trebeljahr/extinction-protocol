import type { DamageType } from "../sim/types";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
} from "../sim/world";
import { useGame } from "../store";

const DAMAGE_TYPE_ORDER: DamageType[] = ["kinetic", "electric", "cold", "explosive"];

const ENEMY_DESC: Record<string, string> = {
  raptor: "Fast, lightly armored. Weak to shock.",
  swarm: "Tiny, fast, fragile. Comes in huge numbers — built for AoE.",
  allosaur: "Balanced bruiser. No exploitable weakness.",
  stego:
    "Armored back plates. Shrugs off kinetic; cracks under explosives. Partially resists chill.",
  armored:
    "Juggernaut. Hardened against blast and shock. Heavy momentum shrugs off chill — only kinetic reliably hurts.",
};

export const EnemyPanel = () => {
  const kind = useGame((s) => s.ui.inspectedEnemyKind);
  const hp = useGame((s) => s.ui.inspectedEnemyHp);
  const maxHp = useGame((s) => s.ui.inspectedEnemyMaxHp);
  const alive = useGame((s) => s.ui.inspectedEnemyAlive);

  if (kind === null) return null;

  const hpPct = hp !== null && maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const resist = ENEMY_RESIST[kind];
  const slowResist = ENEMY_SLOW_RESIST[kind];

  return (
    <div className="enemy-panel">
      <div className="panel-header">
        <div className={`enemy-swatch kind-${kind}`} />
        <div className="panel-title">
          <div className="panel-name">
            {ENEMY_LABEL[kind]}
            <span className={`enemy-status ${alive ? "alive" : "dead"}`}>
              {alive ? "ALIVE" : "KILLED"}
            </span>
          </div>
          <div className="panel-stats">{ENEMY_DESC[kind]}</div>
        </div>
        <button
          className="btn-close"
          onClick={() => useGame.getState().clearInspectedEnemy()}
          aria-label="close"
        >
          ×
        </button>
      </div>

      {alive && maxHp !== null ? (
        <div className="enemy-hp">
          <div className="enemy-hp-bar">
            <div className="enemy-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <div className="enemy-hp-text">
            {Math.max(0, Math.ceil(hp ?? 0))} / {maxHp} HP
          </div>
        </div>
      ) : (
        <div className="enemy-hp">
          <div className="enemy-hp-text dim">Max HP this wave · {maxHp ?? "—"}</div>
        </div>
      )}

      <div className="resist-label">Damage taken</div>
      <div className="resist-row">
        {DAMAGE_TYPE_ORDER.map((type) => {
          const mul = resist[type];
          const pct = Math.round((mul - 1) * 100);
          const cls = pct > 0 ? "bad" : pct < 0 ? "good" : "neutral";
          return (
            <div
              key={type}
              className={`resist-chip ${cls}`}
              title={`${DAMAGE_TYPE_LABEL[type]}: ${mul.toFixed(2)}×`}
            >
              <span className="resist-name" style={{ color: DAMAGE_TYPE_COLOR[type] }}>
                {DAMAGE_TYPE_LABEL[type]}
              </span>
              <span className="resist-val">{pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "·"}</span>
            </div>
          );
        })}
      </div>

      {slowResist > 0 && (
        <div className="resist-row">
          <div
            className="resist-chip good"
            title={`Chill resistance: ${Math.round(slowResist * 100)}%`}
          >
            <span className="resist-name" style={{ color: DAMAGE_TYPE_COLOR.cold }}>
              Chill resist
            </span>
            <span className="resist-val">{Math.round(slowResist * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
