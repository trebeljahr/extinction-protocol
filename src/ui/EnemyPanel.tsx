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
  swarm: "Tiny, fragile, dangerous in numbers. Shock and AoE shred entire packs.",
  para: "Agile runner. No real weakness — just out-DPS it.",
  allosaur: "Balanced bruiser. No exploitable weakness.",
  stego: "Armored back plates. Shrugs off kinetic and explosive — shock cracks them.",
  armored:
    "Juggernaut. Hardened against shock and blast. Kinetic gets through best. Heavy slow resistance.",
  titan: "Colossus. Only cold meaningfully damages it. Heavy slow resistance.",
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
          type="button"
          className="btn-close"
          data-ui-sound="close"
          onClick={() => useGame.getState().clearInspectedEnemy()}
          aria-label="close"
        >
          ×
        </button>
      </div>

      {alive && maxHp !== null ? (
        <div className="mb-3">
          <div className="h-2 bg-white/8 rounded-sm overflow-hidden border border-border-faint">
            <div className="enemy-hp-fill" style={{ width: `${hpPct * 100}%` }} />
          </div>
          <div className="text-[11px] text-fg-muted mt-1 tabular-nums tracking-tight">
            {Math.max(0, Math.ceil(hp ?? 0))} / {maxHp} HP
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-[11px] text-fg-muted mt-1 tabular-nums tracking-tight opacity-65 italic">
            Max HP this wave · {maxHp ?? "—"}
          </div>
        </div>
      )}

      <div className="text-[11px] font-bold tracking-wide text-fg-muted uppercase mb-1.5">
        Damage taken
      </div>
      <div className="grid grid-cols-4 auto-rows-fr gap-1 mb-3">
        {DAMAGE_TYPE_ORDER.map((type) => {
          const mul = resist[type];
          const pct = Math.round((mul - 1) * 100);
          const state: "good" | "bad" | "neutral" = pct > 0 ? "bad" : pct < 0 ? "good" : "neutral";
          return (
            <ResistChip
              key={type}
              state={state}
              title={`${DAMAGE_TYPE_LABEL[type]}: ${mul.toFixed(2)}×`}
              nameColor={DAMAGE_TYPE_COLOR[type]}
              name={DAMAGE_TYPE_LABEL[type]}
              value={pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "·"}
            />
          );
        })}
      </div>

      {slowResist > 0 && (
        <div className="grid grid-cols-4 auto-rows-fr gap-1 mb-3">
          <ResistChip
            state="good"
            title={`Chill resistance: ${Math.round(slowResist * 100)}%`}
            nameColor={DAMAGE_TYPE_COLOR.cold}
            name="Chill resist"
            value={`${Math.round(slowResist * 100)}%`}
          />
        </div>
      )}
    </div>
  );
};

const CHIP_BG: Record<"good" | "bad" | "neutral", string> = {
  good: "bg-tint-green border-[rgba(61,255,138,0.45)]",
  bad: "bg-tint-red border-[rgba(255,90,122,0.45)]",
  neutral: "bg-surface-faint border-border-faint",
};
const CHIP_VAL_COLOR: Record<"good" | "bad" | "neutral", string> = {
  good: "text-green",
  bad: "text-red",
  neutral: "text-fg-muted",
};

const ResistChip = ({
  state,
  title,
  nameColor,
  name,
  value,
}: {
  state: "good" | "bad" | "neutral";
  title: string;
  nameColor: string;
  name: string;
  value: string;
}) => (
  <div
    className={`flex flex-col items-center px-1 py-[5px] rounded-[5px] leading-tight border ${CHIP_BG[state]}`}
    title={title}
  >
    <span className="text-[9px] font-bold tracking-tight opacity-85" style={{ color: nameColor }}>
      {name}
    </span>
    <span className={`text-[11px] font-bold tabular-nums ${CHIP_VAL_COLOR[state]}`}>{value}</span>
  </div>
);
