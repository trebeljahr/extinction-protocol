import { useEffect } from "react";
import { audio } from "../audio/AudioManager";
import {
  ENEMY_DESCRIPTION,
  ENEMY_SUBTITLE,
  MATRIARCH_DESCRIPTION,
  MATRIARCH_SUBTITLE,
} from "../sim/enemyText";
import type { DamageType } from "../sim/types";
import {
  BOSS_VARIANT_LABEL,
  BOSS_VARIANT_RESIST,
  BOSS_VARIANT_STATS,
  DAMAGE_TYPE_LABEL,
  ENEMY_LABEL,
  ENEMY_RESIST,
  ENEMY_STATS,
} from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyIcon } from "./EnemyIcon";
import { EnemyPreview } from "./EnemyPreview";

const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive", "flame"];

export const NewEnemyAlert = () => {
  const queue = useGame((s) => s.newEnemyQueue);
  const dismiss = useGame((s) => s.dismissNewEnemy);
  const sighting = queue[0];

  useEffect(() => {
    if (!sighting) return;
    audio.play("new-enemy", "enemies", 0.7, 200, 2.5);
  }, [sighting]);

  useEffect(() => {
    if (!sighting) return;
    // Swallow every key while the alert is up — otherwise game hotkeys
    // (P, R, 1–4, Space) leak through and confuse state.
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        dismiss();
      }
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sighting, dismiss]);

  if (!sighting) return null;

  // Matriarch variants pull their data from BOSS_VARIANT_* so the popup
  // shows the queen's real HP / resists / 20-life leak damage, not the
  // base "boss" row.
  const isMatriarch = sighting.tag === "matriarch";
  const resist = isMatriarch
    ? BOSS_VARIANT_RESIST[sighting.variant]
    : ENEMY_RESIST[sighting.species];
  const stats = isMatriarch ? BOSS_VARIANT_STATS[sighting.variant] : ENEMY_STATS[sighting.species];
  const label = isMatriarch ? BOSS_VARIANT_LABEL[sighting.variant] : ENEMY_LABEL[sighting.species];
  const subtitle = isMatriarch
    ? MATRIARCH_SUBTITLE[sighting.variant]
    : ENEMY_SUBTITLE[sighting.species];
  const description = isMatriarch
    ? MATRIARCH_DESCRIPTION[sighting.variant]
    : ENEMY_DESCRIPTION[sighting.species];

  const weakest = DAMAGE_TYPES.reduce(
    (best, t) => (resist[t] > resist[best] ? t : best),
    DAMAGE_TYPES[0],
  );
  const weakestPct = Math.round((resist[weakest] - 1) * 100);
  const remaining = queue.length - 1;

  return (
    <div className="overlay new-enemy-overlay">
      <div className="new-enemy-card flex flex-col items-stretch gap-2.5 w-[360px] max-w-[calc(100vw-32px)] pt-[22px] px-[26px] pb-6 rounded-2xl border border-[rgba(255,170,110,0.35)]">
        <div className="self-center text-[10px] tracking-uber text-orange font-bold px-2.5 py-1 rounded-sm border border-[rgba(255,178,102,0.45)] bg-[rgba(255,178,102,0.08)] uppercase">
          {isMatriarch ? "MATRIARCH DETECTED · DATABASE UPDATED" : "NEW HOSTILE · DATABASE UPDATED"}
        </div>
        <div
          className="self-center mt-1 w-14 h-14 rounded-md overflow-hidden border border-[rgba(255,178,102,0.2)] bg-[rgba(8,12,18,0.55)]"
          aria-hidden
        >
          {isMatriarch ? (
            <EnemyIcon kind="boss" bossVariant={sighting.variant} />
          ) : (
            <EnemyIcon kind={sighting.species} />
          )}
        </div>
        <h1 className="mt-1 mb-0 text-center text-[28px] font-bold tracking-[0.02em] text-white font-display">
          {label}
        </h1>
        <div className="text-center text-fg-muted text-xs tracking-[0.18em] uppercase -mt-0.5">
          {subtitle}
        </div>
        <div className="w-[260px] h-[260px] self-center rounded-xl overflow-hidden border border-border bg-[#1b2a22]">
          {isMatriarch ? (
            <EnemyPreview kind="boss" bossVariant={sighting.variant} size={260} />
          ) : (
            <EnemyPreview kind={sighting.species} size={260} />
          )}
        </div>
        <p className="mt-0.5 mb-0 text-[13px] leading-[1.55] text-[#cfd8e3] text-center">
          {description}
        </p>
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-[rgba(6,10,14,0.5)] border border-[rgba(120,160,200,0.14)] rounded-lg">
          <NewEnemyStat label="HP" value={stats.hp} />
          <NewEnemyStat label="Speed" value={stats.speed.toFixed(1)} />
          <NewEnemyStat label="Damage" value={stats.damage} highlight={isMatriarch} />
          <NewEnemyStat label="Bounty" value={`${stats.bounty}g`} />
        </div>
        {isMatriarch && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[rgba(255,90,58,0.10)] border border-[rgba(255,90,58,0.45)]">
            <div className="text-[10px] tracking-[0.16em] text-[#ff8a6a] uppercase font-bold">
              Warning
            </div>
            <div className="ml-auto text-[#ffb39a] text-[13px] font-semibold tabular-nums">
              {stats.damage} lives on leak — instant loss
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[rgba(61,255,138,0.07)] border border-[rgba(61,255,138,0.28)]">
          <div className="text-[10px] tracking-[0.16em] text-[#8ad9a5] uppercase font-bold">
            Recommended
          </div>
          {weakestPct > 0 ? (
            <div className="flex items-center gap-2 ml-auto text-green text-[13px] font-semibold">
              <DamageIcon type={weakest} size={18} />
              <span>{DAMAGE_TYPE_LABEL[weakest]}</span>
              <span className="text-green tabular-nums">+{weakestPct}% dmg</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-auto text-fg-muted text-[13px] font-medium">
              <span>Balanced — no strong exploit</span>
            </div>
          )}
        </div>
        <button type="button" className="btn mt-1 w-full text-sm px-5 py-3" onClick={dismiss}>
          Continue {remaining > 0 ? `(${remaining} more)` : ""}
        </button>
      </div>
    </div>
  );
};

const NewEnemyStat = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-[9px] tracking-[0.16em] text-[#7a8594] uppercase">{label}</span>
    <span
      className={`text-[15px] font-bold tabular-nums ${highlight ? "text-[#ff8a6a]" : "text-[#eef2f8]"}`}
    >
      {value}
    </span>
  </div>
);
