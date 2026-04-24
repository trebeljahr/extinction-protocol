import { useEffect } from "react";
import { audio } from "../audio/AudioManager";
import type { DamageType, EnemyKind } from "../sim/types";
import { DAMAGE_TYPE_LABEL, ENEMY_LABEL, ENEMY_RESIST, ENEMY_STATS } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyPreview } from "./EnemyPreview";

const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive"];

const SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Aerial swarm",
  para: "Runner",
  allosaur: "Apex predator",
  stego: "Armored grazer",
  armored: "Juggernaut",
  titan: "Colossus",
};

const DESCRIPTION: Record<EnemyKind, string> = {
  raptor: "Fast pack hunter. Low HP but keeps coming — electric chains melt entire groups.",
  swarm: "Tiny and numerous. Only dangerous in crowds. Splash weapons clear them instantly.",
  para: "Agile herbivore with no strong weaknesses. Pressure it with raw damage.",
  allosaur:
    "Apex predator. Balanced resistances — nothing special works, but nothing fails either.",
  stego: "Plated back soaks kinetic hits. Crack them open with explosives.",
  armored: "Juggernaut. Resists most damage; only electric and explosive make a dent.",
  titan:
    "Colossal. Shrugs off anything that isn't cold or brute bombardment. Slow, but every step costs lives.",
};

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
      <div className="new-enemy-card">
        <div className="new-enemy-tag">NEW HOSTILE · DATABASE UPDATED</div>
        <h1 className="new-enemy-title">{ENEMY_LABEL[kind]}</h1>
        <div className="new-enemy-subtitle">{SUBTITLE[kind]}</div>
        <div className="new-enemy-preview-wrap">
          <EnemyPreview kind={kind} size={260} />
        </div>
        <p className="new-enemy-desc">{DESCRIPTION[kind]}</p>
        <div className="new-enemy-stats">
          <div>
            <span className="new-enemy-stat-label">HP</span>
            <span className="new-enemy-stat-val">{stats.hp}</span>
          </div>
          <div>
            <span className="new-enemy-stat-label">Speed</span>
            <span className="new-enemy-stat-val">{stats.speed.toFixed(1)}</span>
          </div>
          <div>
            <span className="new-enemy-stat-label">Damage</span>
            <span className="new-enemy-stat-val">{stats.damage}</span>
          </div>
          <div>
            <span className="new-enemy-stat-label">Bounty</span>
            <span className="new-enemy-stat-val">{stats.bounty}g</span>
          </div>
        </div>
        <div className="new-enemy-weakness">
          <div className="new-enemy-weakness-label">Recommended</div>
          {weakestPct > 0 ? (
            <div className="new-enemy-weakness-chip">
              <DamageIcon type={weakest} size={18} />
              <span>{DAMAGE_TYPE_LABEL[weakest]}</span>
              <span className="new-enemy-weakness-val">+{weakestPct}% dmg</span>
            </div>
          ) : (
            <div className="new-enemy-weakness-chip balanced">
              <span>Balanced — no strong exploit</span>
            </div>
          )}
        </div>
        <button type="button" className="btn new-enemy-continue" onClick={dismiss}>
          Continue {remaining > 0 ? `(${remaining} more)` : ""}
        </button>
      </div>
    </div>
  );
};
