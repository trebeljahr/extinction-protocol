import { useEffect } from "react";
import { audio } from "../audio/AudioManager";
import { ENEMY_DESCRIPTION, ENEMY_SUBTITLE } from "../sim/enemyText";
import type { DamageType } from "../sim/types";
import { DAMAGE_TYPE_LABEL, ENEMY_LABEL, ENEMY_RESIST, ENEMY_STATS } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyPreview } from "./EnemyPreview";

const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive"];

export const NewEnemyAlert = () => {
  const queue = useGame((s) => s.newEnemyQueue);
  const dismiss = useGame((s) => s.dismissNewEnemy);
  const kind = queue[0];

  useEffect(() => {
    if (!kind) return;
    audio.play("new-enemy", 0.7, 200, 2.5);
  }, [kind]);

  useEffect(() => {
    if (!kind) return;
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
  }, [kind, dismiss]);

  if (!kind) return null;

  const resist = ENEMY_RESIST[kind];
  const weakest = DAMAGE_TYPES.reduce(
    (best, t) => (resist[t] > resist[best] ? t : best),
    DAMAGE_TYPES[0],
  );
  const weakestPct = Math.round((resist[weakest] - 1) * 100);
  const stats = ENEMY_STATS[kind];
  const remaining = queue.length - 1;

  return (
    <div className="overlay new-enemy-overlay">
      <div className="new-enemy-card flex flex-col items-stretch gap-2.5 w-[360px] max-w-[calc(100vw-32px)] pt-[22px] px-[26px] pb-6 rounded-2xl border border-[rgba(255,170,110,0.35)]">
        <div className="self-center text-[10px] tracking-uber text-orange font-bold px-2.5 py-1 rounded-sm border border-[rgba(255,178,102,0.45)] bg-[rgba(255,178,102,0.08)] uppercase">
          NEW HOSTILE · DATABASE UPDATED
        </div>
        <h1 className="mt-1 mb-0 text-center text-[28px] font-bold tracking-[0.02em] text-white font-display">
          {ENEMY_LABEL[kind]}
        </h1>
        <div className="text-center text-fg-muted text-xs tracking-[0.18em] uppercase -mt-0.5">
          {ENEMY_SUBTITLE[kind]}
        </div>
        <div className="w-[260px] h-[260px] self-center rounded-xl overflow-hidden border border-border bg-[#1b2a22]">
          <EnemyPreview kind={kind} size={260} />
        </div>
        <p className="mt-0.5 mb-0 text-[13px] leading-[1.55] text-[#cfd8e3] text-center">
          {ENEMY_DESCRIPTION[kind]}
        </p>
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-[rgba(6,10,14,0.5)] border border-[rgba(120,160,200,0.14)] rounded-lg">
          <NewEnemyStat label="HP" value={stats.hp} />
          <NewEnemyStat label="Speed" value={stats.speed.toFixed(1)} />
          <NewEnemyStat label="Damage" value={stats.damage} />
          <NewEnemyStat label="Bounty" value={`${stats.bounty}g`} />
        </div>
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

const NewEnemyStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-[9px] tracking-[0.16em] text-[#7a8594] uppercase">{label}</span>
    <span className="text-[15px] font-bold text-[#eef2f8] tabular-nums">{value}</span>
  </div>
);
