import { ENEMY_DESCRIPTION } from "../sim/enemyText";
import type { DamageType, EnemyChip } from "../sim/types";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  ELITE_RESIST_FLATTEN,
  ELITE_SLOW_RESIST_BONUS,
  ELITE_SLOW_RESIST_CAP,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
  FIERCE_DAMAGE_MUL,
  HEAL_AURA_RANGE,
  HEAL_AURA_RATE,
  REGEN_DAMAGE_PAUSE,
  REGEN_RATE,
} from "../sim/world";
import { useGame } from "../store";

const DAMAGE_TYPE_ORDER: DamageType[] = ["kinetic", "electric", "cold", "explosive"];

// Chip metadata — color + short tooltip. Layout reads consistently
// across the panel so combos read at a glance ("Shielded Elite Stego").
type ChipInfo = { name: string; color: string; bg: string; border: string; title: string };
const CHIP_INFO: Record<EnemyChip, ChipInfo> = {
  shielded: {
    name: "Shielded",
    color: "#7fc8ff",
    bg: "rgba(127,200,255,0.10)",
    border: "rgba(127,200,255,0.5)",
    title: "Shielded — energy bubble absorbs damage before HP, regens 4s after a full break",
  },
  healAura: {
    name: "Healer",
    color: "#7eff8a",
    bg: "rgba(126,255,138,0.10)",
    border: "rgba(126,255,138,0.5)",
    title: `Healer — pulses ${HEAL_AURA_RATE} HP/sec to allies within ${HEAL_AURA_RANGE.toFixed(1)}u`,
  },
  regen: {
    name: "Regen",
    color: "#bbffc8",
    bg: "rgba(187,255,200,0.10)",
    border: "rgba(187,255,200,0.5)",
    title: `Regen — heals ${REGEN_RATE} HP/sec, paused for ${REGEN_DAMAGE_PAUSE.toFixed(1)}s after damage`,
  },
  elite: {
    name: "Elite",
    color: "#ffb030",
    bg: "rgba(255,176,48,0.10)",
    border: "rgba(255,176,48,0.5)",
    title: `Elite — resist spread flattened by ${Math.round(ELITE_RESIST_FLATTEN * 100)}%, +${Math.round(ELITE_SLOW_RESIST_BONUS * 100)}% slow resist`,
  },
  fierce: {
    name: "Fierce",
    color: "#ff5a3a",
    bg: "rgba(255,90,58,0.12)",
    border: "rgba(255,90,58,0.5)",
    title: `Fierce — deals ${Math.round((FIERCE_DAMAGE_MUL - 1) * 100)}% more damage on contact`,
  },
};

export const EnemyPanel = () => {
  const kind = useGame((s) => s.ui.inspectedEnemyKind);
  const hp = useGame((s) => s.ui.inspectedEnemyHp);
  const maxHp = useGame((s) => s.ui.inspectedEnemyMaxHp);
  const alive = useGame((s) => s.ui.inspectedEnemyAlive);
  const shield = useGame((s) => s.ui.inspectedEnemyShield);
  const maxShield = useGame((s) => s.ui.inspectedEnemyMaxShield);
  const healAura = useGame((s) => s.ui.inspectedEnemyHealAura);
  const regen = useGame((s) => s.ui.inspectedEnemyRegen);
  const elite = useGame((s) => s.ui.inspectedEnemyElite);
  const fierce = useGame((s) => s.ui.inspectedEnemyFierce);

  if (kind === null) return null;

  const hpPct = hp !== null && maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const shieldPct =
    shield !== null && maxShield > 0 ? Math.max(0, Math.min(1, shield / maxShield)) : 0;
  const baseResist = ENEMY_RESIST[kind];
  // Elite chip flattens the resist spread toward 1×, mirroring
  // applyDamage so chips reflect the real damage taken in-flight.
  const resist = elite
    ? (Object.fromEntries(
        DAMAGE_TYPE_ORDER.map((t) => [
          t,
          baseResist[t] + (1 - baseResist[t]) * ELITE_RESIST_FLATTEN,
        ]),
      ) as Record<DamageType, number>)
    : baseResist;
  const baseSlowResist = ENEMY_SLOW_RESIST[kind];
  const slowResist = elite
    ? Math.min(ELITE_SLOW_RESIST_CAP, baseSlowResist + ELITE_SLOW_RESIST_BONUS)
    : baseSlowResist;

  const activeChips: EnemyChip[] = [];
  if (maxShield > 0) activeChips.push("shielded");
  if (healAura) activeChips.push("healAura");
  if (regen) activeChips.push("regen");
  if (elite) activeChips.push("elite");
  if (fierce) activeChips.push("fierce");

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
          <div className="panel-stats">{ENEMY_DESCRIPTION[kind]}</div>
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

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {activeChips.map((c) => {
            const info = CHIP_INFO[c];
            return (
              <span
                key={c}
                className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-[4px] border"
                style={{ color: info.color, borderColor: info.border, background: info.bg }}
                title={info.title}
              >
                {info.name}
              </span>
            );
          })}
        </div>
      )}

      {alive && maxShield > 0 && (
        <div className="mb-2">
          <div
            className="h-2 rounded-sm overflow-hidden border"
            style={{ background: "rgba(127,200,255,0.10)", borderColor: "rgba(127,200,255,0.4)" }}
          >
            <div
              style={{
                width: `${shieldPct * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg,#7fc8ff,#cdeaff)",
              }}
            />
          </div>
          <div className="text-[11px] text-fg-muted mt-1 tabular-nums tracking-tight">
            {Math.max(0, Math.ceil(shield ?? 0))} / {maxShield} Shield
          </div>
        </div>
      )}

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
              title={`${DAMAGE_TYPE_LABEL[type]}: ${mul.toFixed(2)}×${elite ? " (elite)" : ""}`}
              nameColor={DAMAGE_TYPE_COLOR[type]}
              name={DAMAGE_TYPE_LABEL[type]}
              value={pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "·"}
            />
          );
        })}
      </div>

      {(slowResist > 0 || healAura || regen) && (
        <div className="grid grid-cols-4 auto-rows-fr gap-1 mb-3">
          {slowResist > 0 && (
            <ResistChip
              state="good"
              title={`Chill resistance: ${Math.round(slowResist * 100)}%${elite ? ` (+${Math.round(ELITE_SLOW_RESIST_BONUS * 100)}% elite)` : ""}`}
              nameColor={DAMAGE_TYPE_COLOR.cold}
              name="Chill resist"
              value={`${Math.round(slowResist * 100)}%`}
            />
          )}
          {healAura && (
            <ResistChip
              state="good"
              title={`Heal aura: ${HEAL_AURA_RATE} HP/sec within ${HEAL_AURA_RANGE.toFixed(1)}u`}
              nameColor="#7eff8a"
              name="Heal aura"
              value={`${HEAL_AURA_RANGE.toFixed(1)}u`}
            />
          )}
          {regen && (
            <ResistChip
              state="good"
              title={`Self-regen: ${REGEN_RATE} HP/sec, pauses ${REGEN_DAMAGE_PAUSE.toFixed(1)}s after damage`}
              nameColor="#bbffc8"
              name="Self regen"
              value={`+${REGEN_RATE}/s`}
            />
          )}
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
