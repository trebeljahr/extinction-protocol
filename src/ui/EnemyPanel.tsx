import { useTranslation } from "react-i18next";
import type { DamageType, EnemyChip } from "../sim/types";
import { clamp01 } from "../sim/vec2";
import {
  ADAPTIVE_TINT_BY_TYPE,
  BOSS_VARIANT_LABEL,
  BOSS_VARIANT_RESIST,
  BOSS_VARIANT_SLOW_RESIST,
  BOSS_VARIANT_STATS,
  DAMAGE_TYPE_COLOR,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
  HEAL_AURA_RANGE,
  HEAL_AURA_RATE,
  REGEN_DAMAGE_PAUSE,
  REGEN_RATE,
} from "../sim/world";
import { useGame } from "../store";
import { EnemyIcon } from "./EnemyIcon";
import { RightOverlay } from "./RightOverlay";

const DAMAGE_TYPE_ORDER: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

// Chip swatch colors. Name + tooltip copy comes from the i18n catalog
// (enemyPanel.chip.<key>); CHIP_KEY maps the chip id to its catalog key.
type ChipInfo = { color: string; bg: string; border: string };
const CHIP_INFO: Record<EnemyChip, ChipInfo> = {
  shielded: { color: "#7fc8ff", bg: "rgba(127,200,255,0.10)", border: "rgba(127,200,255,0.5)" },
  healAura: { color: "#7eff8a", bg: "rgba(126,255,138,0.10)", border: "rgba(126,255,138,0.5)" },
  regen: { color: "#bbffc8", bg: "rgba(187,255,200,0.10)", border: "rgba(187,255,200,0.5)" },
};
const CHIP_KEY: Record<EnemyChip, string> = {
  shielded: "shielded",
  healAura: "healer",
  regen: "regen",
};

export const EnemyPanel = () => {
  const { t } = useTranslation();
  const kind = useGame((s) => s.ui.inspectedEnemyKind);
  const bossVariant = useGame((s) => s.ui.inspectedBossVariant);
  const hp = useGame((s) => s.ui.inspectedEnemyHp);
  const maxHp = useGame((s) => s.ui.inspectedEnemyMaxHp);
  const alive = useGame((s) => s.ui.inspectedEnemyAlive);
  const shield = useGame((s) => s.ui.inspectedEnemyShield);
  const maxShield = useGame((s) => s.ui.inspectedEnemyMaxShield);
  const healAura = useGame((s) => s.ui.inspectedEnemyHealAura);
  const regen = useGame((s) => s.ui.inspectedEnemyRegen);
  const extraResists = useGame((s) => s.ui.inspectedEnemyExtraResists);
  const adaptiveType = useGame((s) => s.ui.inspectedEnemyAdaptiveType);

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
  const description = isMatriarch
    ? t(`enemies:matriarch.${bossVariant}.description`)
    : t(`enemies:${kind}.description`);

  const hpPct = hp !== null && maxHp ? clamp01(hp / maxHp) : 0;
  const shieldPct = shield !== null && maxShield > 0 ? clamp01(shield / maxShield) : 0;
  // Resists chip multiplies on top of base species / matriarch resists.
  // Mirrors applyDamage so the panel reflects the real damage taken
  // in-flight.
  const resist = Object.fromEntries(
    DAMAGE_TYPE_ORDER.map((t) => {
      const extra = extraResists[t] ?? 1;
      return [t, baseResist[t] * extra];
    }),
  ) as Record<DamageType, number>;
  const hasAdaptation = Object.keys(extraResists).length > 0;
  const slowResist = baseSlowResist;

  const activeChips: EnemyChip[] = [];
  if (maxShield > 0) activeChips.push("shielded");
  if (healAura) activeChips.push("healAura");
  if (regen) activeChips.push("regen");

  return (
    <RightOverlay className="enemy-panel">
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
              {alive ? t("enemyPanel.alive") : t("enemyPanel.killed")}
            </span>
          </div>
          <div className="panel-stats">{description}</div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={() => useGame.getState().clearInspectedEnemy()}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      {(activeChips.length > 0 || hasAdaptation) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {activeChips.map((c) => {
            const info = CHIP_INFO[c];
            const key = CHIP_KEY[c];
            const values =
              c === "healAura"
                ? { rate: HEAL_AURA_RATE, range: HEAL_AURA_RANGE.toFixed(1) }
                : c === "regen"
                  ? { rate: REGEN_RATE, pause: REGEN_DAMAGE_PAUSE.toFixed(1) }
                  : {};
            return (
              <span
                key={c}
                className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-[4px] border"
                style={{ color: info.color, borderColor: info.border, background: info.bg }}
                title={t(`enemyPanel.chip.${key}Title`, values)}
              >
                {t(`enemyPanel.chip.${key}`)}
              </span>
            );
          })}
          {hasAdaptation &&
            (() => {
              // Adapted-spawn badge: hue matches the dino's body tint so
              // the chip and the on-screen creature read as one signal.
              // Falls back to the first non-1 extraResists key when the
              // resist is from a level-script chip rather than the
              // adaptive snapshot (no adaptiveType set).
              const fallbackType =
                (Object.keys(extraResists) as DamageType[]).find((dt) => extraResists[dt] !== 1) ??
                null;
              const tintType = adaptiveType ?? fallbackType;
              const tintHex = tintType
                ? (ADAPTIVE_TINT_BY_TYPE[tintType] ?? DAMAGE_TYPE_COLOR[tintType])
                : "#9be079";
              const adaptLines = DAMAGE_TYPE_ORDER.flatMap((dt) => {
                const extra = extraResists[dt];
                if (extra === undefined || extra === 1) return [];
                const pct = Math.round((1 - extra) * 100);
                const typeLabel = t(`damageTypes.${dt}`);
                return [
                  pct > 0
                    ? t("enemyPanel.resistanceSuffix", { type: typeLabel, pct })
                    : t("enemyPanel.vulnerabilitySuffix", { type: typeLabel, pct: -pct }),
                ];
              }).join(" · ");
              return (
                <span
                  className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-[4px] border"
                  style={{
                    color: tintHex,
                    borderColor: tintHex,
                    background: "rgba(255,255,255,0.04)",
                  }}
                  title={t("enemyPanel.adaptedTitle", {
                    type: tintType ? t(`damageTypes.${tintType}`).toLowerCase() : "specific",
                    lines: adaptLines,
                  })}
                >
                  {t("enemyPanel.adapted", { lines: adaptLines })}
                </span>
              );
            })()}
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
            {Math.max(0, Math.ceil(shield ?? 0))} / {maxShield} {t("enemyPanel.shield")}
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
            {t("enemyPanel.maxHpThisWave", { value: maxHp ?? "—" })}
          </div>
        </div>
      )}

      {isMatriarch && variantStats !== null && (
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 mb-3 rounded-md bg-[rgba(255,90,58,0.10)] border border-[rgba(255,90,58,0.45)]">
          <span className="text-[9px] tracking-[0.16em] text-[#ff8a6a] uppercase font-bold">
            {t("enemyPanel.leakDamage")}
          </span>
          <span className="ml-auto text-[#ffb39a] text-[12px] font-semibold tabular-nums">
            {t("enemyPanel.leakLives", { damage: variantStats.damage })}
          </span>
        </div>
      )}

      <div className="text-[11px] font-bold tracking-wide text-fg-muted uppercase mb-1.5">
        {t("enemyPanel.damageTaken")}
      </div>
      <div className="grid grid-cols-5 auto-rows-fr gap-1 mb-3">
        {DAMAGE_TYPE_ORDER.map((type) => {
          const mul = resist[type];
          const extra = extraResists[type] ?? 1;
          const adapted = extra !== 1;
          // Resistance from adaptation only — extra<1 means damage of this
          // type is reduced by the adapted fraction. Display as a positive
          // percent so "40% adapted" reads as a resistance shield.
          const adaptPct = adapted ? Math.round((1 - extra) * 100) : 0;
          const pct = Math.round((mul - 1) * 100);
          let value: string;
          if (mul === 0) value = "0×";
          else if (pct > 0) value = `+${pct}%`;
          else if (pct < 0) value = `${pct}%`;
          else value = "·";
          const state: "good" | "bad" | "neutral" = pct > 0 ? "bad" : pct < 0 ? "good" : "neutral";
          const typeLabel = t(`damageTypes.${type}`);
          const titleParts = [`${typeLabel}: ${mul.toFixed(2)}×`];
          if (adapted) {
            titleParts.push(
              adaptPct > 0
                ? t("enemyPanel.adaptedResist", { pct: adaptPct })
                : t("enemyPanel.adaptedExtra", { pct: -adaptPct }),
            );
          }
          return (
            <ResistChip
              key={type}
              state={state}
              adapted={adapted}
              adaptPct={adapted ? adaptPct : null}
              title={titleParts.join(" ")}
              nameColor={DAMAGE_TYPE_COLOR[type]}
              name={typeLabel}
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
              title={t("enemyPanel.chillResistTitle", { pct: Math.round(slowResist * 100) })}
              nameColor={DAMAGE_TYPE_COLOR.cold}
              name={t("enemyPanel.chillResist")}
              value={`${Math.round(slowResist * 100)}%`}
            />
          )}
          {healAura && (
            <ResistChip
              state="good"
              title={t("enemyPanel.healAuraTitle", {
                rate: HEAL_AURA_RATE,
                range: HEAL_AURA_RANGE.toFixed(1),
              })}
              nameColor="#7eff8a"
              name={t("enemyPanel.healAura")}
              value={`${HEAL_AURA_RANGE.toFixed(1)}u`}
            />
          )}
          {regen && (
            <ResistChip
              state="good"
              title={t("enemyPanel.selfRegenTitle", {
                rate: REGEN_RATE,
                pause: REGEN_DAMAGE_PAUSE.toFixed(1),
              })}
              nameColor="#bbffc8"
              name={t("enemyPanel.selfRegen")}
              value={t("enemyPanel.selfRegenValue", { rate: REGEN_RATE })}
            />
          )}
        </div>
      )}
    </RightOverlay>
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
  adaptPct,
  title,
  nameColor,
  name,
  value,
}: {
  state: "good" | "bad" | "neutral";
  adapted?: boolean;
  adaptPct?: number | null;
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
    {adaptPct !== null && adaptPct !== undefined && (
      <span
        className="text-[8.5px] font-bold tabular-nums tracking-tight mt-[1px]"
        style={{ color: "#ffb266" }}
      >
        {adaptPct > 0 ? `↓${adaptPct}% adapt` : `↑${-adaptPct}% adapt`}
      </span>
    )}
  </div>
);
