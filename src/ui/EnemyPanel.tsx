import { ENEMY_DESCRIPTION, MATRIARCH_DESCRIPTION } from "../sim/enemyText";
import type { DamageType, EnemyChip } from "../sim/types";
import {
  BOSS_VARIANT_LABEL,
  BOSS_VARIANT_RESIST,
  BOSS_VARIANT_SLOW_RESIST,
  BOSS_VARIANT_STATS,
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
import { EnemyIcon } from "./EnemyIcon";

const DAMAGE_TYPE_ORDER: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

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
  const bossVariant = useGame((s) => s.ui.inspectedBossVariant);
  const hp = useGame((s) => s.ui.inspectedEnemyHp);
  const maxHp = useGame((s) => s.ui.inspectedEnemyMaxHp);
  const alive = useGame((s) => s.ui.inspectedEnemyAlive);
  const shield = useGame((s) => s.ui.inspectedEnemyShield);
  const maxShield = useGame((s) => s.ui.inspectedEnemyMaxShield);
  const healAura = useGame((s) => s.ui.inspectedEnemyHealAura);
  const regen = useGame((s) => s.ui.inspectedEnemyRegen);
  const elite = useGame((s) => s.ui.inspectedEnemyElite);
  const fierce = useGame((s) => s.ui.inspectedEnemyFierce);
  const extraResists = useGame((s) => s.ui.inspectedEnemyExtraResists);

  if (kind === null) return null;

  // Matriarch variants route their base resists / slow resist / damage
  // through BOSS_VARIANT_* so the panel shows the queen's actual
  // damage taken and 20-life leak warning, not the generic boss row.
  const isMatriarch = kind === "boss" && bossVariant !== null;
  const variantStats = isMatriarch ? BOSS_VARIANT_STATS[bossVariant] : null;
  const baseResist = isMatriarch ? BOSS_VARIANT_RESIST[bossVariant] : ENEMY_RESIST[kind];
  const baseSlowResist = isMatriarch
    ? BOSS_VARIANT_SLOW_RESIST[bossVariant]
    : ENEMY_SLOW_RESIST[kind];
  const label = isMatriarch ? BOSS_VARIANT_LABEL[bossVariant] : ENEMY_LABEL[kind];
  const description = isMatriarch ? MATRIARCH_DESCRIPTION[bossVariant] : ENEMY_DESCRIPTION[kind];

  const hpPct = hp !== null && maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const shieldPct =
    shield !== null && maxShield > 0 ? Math.max(0, Math.min(1, shield / maxShield)) : 0;
  // Elite chip flattens the resist spread toward 1×, then the resists
  // chip multiplies on top. Mirrors applyDamage so the panel reflects
  // the real damage taken in-flight.
  const resist = Object.fromEntries(
    DAMAGE_TYPE_ORDER.map((t) => {
      const eliteMul = elite
        ? baseResist[t] + (1 - baseResist[t]) * ELITE_RESIST_FLATTEN
        : baseResist[t];
      const extra = extraResists[t] ?? 1;
      return [t, eliteMul * extra];
    }),
  ) as Record<DamageType, number>;
  const hasAdaptation = Object.keys(extraResists).length > 0;
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
        <div className={`enemy-swatch kind-${kind}`}>
          {isMatriarch ? (
            <EnemyIcon kind="boss" bossVariant={bossVariant} />
          ) : (
            <EnemyIcon kind={kind} />
          )}
        </div>
        <div className="panel-title">
          <div className="panel-name">
            {label}
            <span className={`enemy-status ${alive ? "alive" : "dead"}`}>
              {alive ? "ALIVE" : "KILLED"}
            </span>
          </div>
          <div className="panel-stats">{description}</div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => useGame.getState().clearInspectedEnemy()}
          aria-label="close"
        >
          ×
        </button>
      </div>

      {(activeChips.length > 0 || hasAdaptation) && (
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
          {hasAdaptation && (
            <span
              className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-[4px] border"
              style={{
                color: "#ffb266",
                borderColor: "rgba(255,178,102,0.5)",
                background: "rgba(255,178,102,0.10)",
              }}
              title="Adapted — evolved resistance to specific damage types."
            >
              Adapted
            </span>
          )}
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

      {isMatriarch && variantStats !== null && (
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 mb-3 rounded-md bg-[rgba(255,90,58,0.10)] border border-[rgba(255,90,58,0.45)]">
          <span className="text-[9px] tracking-[0.16em] text-[#ff8a6a] uppercase font-bold">
            Leak damage
          </span>
          <span className="ml-auto text-[#ffb39a] text-[12px] font-semibold tabular-nums">
            {variantStats.damage} lives — instant loss
          </span>
        </div>
      )}

      <div className="text-[11px] font-bold tracking-wide text-fg-muted uppercase mb-1.5">
        Damage taken
      </div>
      <div className="grid grid-cols-5 auto-rows-fr gap-1 mb-3">
        {DAMAGE_TYPE_ORDER.map((type) => {
          const mul = resist[type];
          const adapted = (extraResists[type] ?? 1) !== 1;
          const pct = Math.round((mul - 1) * 100);
          let value: string;
          if (mul === 0) value = "0×";
          else if (pct > 0) value = `+${pct}%`;
          else if (pct < 0) value = `${pct}%`;
          else value = "·";
          const state: "good" | "bad" | "neutral" = pct > 0 ? "bad" : pct < 0 ? "good" : "neutral";
          const titleParts = [`${DAMAGE_TYPE_LABEL[type]}: ${mul.toFixed(2)}×`];
          if (elite) titleParts.push("(elite)");
          if (adapted) titleParts.push("(adapted)");
          return (
            <ResistChip
              key={type}
              state={state}
              adapted={adapted}
              title={titleParts.join(" ")}
              nameColor={DAMAGE_TYPE_COLOR[type]}
              name={DAMAGE_TYPE_LABEL[type]}
              value={value}
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
  adapted,
  title,
  nameColor,
  name,
  value,
}: {
  state: "good" | "bad" | "neutral";
  adapted?: boolean;
  title: string;
  nameColor: string;
  name: string;
  value: string;
}) => (
  <div
    className={`flex flex-col items-center px-1 py-[5px] rounded-[5px] leading-tight border ${CHIP_BG[state]} ${
      adapted ? "ring-1 ring-[rgba(255,178,102,0.55)]" : ""
    }`}
    title={title}
  >
    <span className="text-[9px] font-bold tracking-tight opacity-85" style={{ color: nameColor }}>
      {name}
    </span>
    <span className={`text-[11px] font-bold tabular-nums ${CHIP_VAL_COLOR[state]}`}>{value}</span>
  </div>
);
