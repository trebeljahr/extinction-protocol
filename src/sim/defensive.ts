import type { World } from "./types";
import { distSq } from "./vec2";
import {
  HEAL_AURA_RANGE,
  HEAL_AURA_RATE,
  REGEN_RATE,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_RATE,
  spawnParticles,
} from "./world";

// Shield regen + heal-aura tick. Both are continuous defensive effects
// keyed off chip flags rather than enemy kind, so any combination of
// kind + chips produces the right behavior.

export const updateDefensive = (world: World, dt: number) => {
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (e.maxShield <= 0) continue;
    if (e.shield >= e.maxShield) continue;
    // shieldBrokenAt === 0 → shield was never broken (or just reset after
    // a full regen) — no regen until a fresh full break has happened.
    if (e.shieldBrokenAt === 0) continue;
    if (world.time - e.shieldBrokenAt < SHIELD_REGEN_DELAY) continue;
    e.shield = Math.min(e.maxShield, e.shield + e.maxShield * SHIELD_REGEN_RATE * dt);
    if (e.shield >= e.maxShield) {
      e.shield = e.maxShield;
      e.shieldBrokenAt = 0;
    }
  }

  // Regen chip — passive self-heal, paused briefly after every damage
  // tick. Runs before the heal aura loop so a regen + heal-aura combo
  // stacks naturally (both add HP on the same tick). Cryo T3 freeze-lock
  // and Pyre T3 napalm pause are the per-tower suppression options that
  // can keep a regen enemy from healing through sustained DPS.
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (!e.regen) continue;
    if (e.hp >= e.maxHp) continue;
    if (world.time < e.regenPausedUntil) continue;
    e.hp = Math.min(e.maxHp, e.hp + REGEN_RATE * dt);
  }

  // Healers — any enemy carrying the healAura chip ticks HP into nearby
  // allies. Quadratic in (healers × enemies) but healer counts stay
  // small so the total cost is fine vs. building a spatial index.
  // Healers don't heal each other, which keeps healer-stacks from being
  // immortal — players can still focus a stack down individually.
  const r2 = HEAL_AURA_RANGE * HEAL_AURA_RANGE;
  for (const m of world.enemies) {
    if (!m.alive) continue;
    if (!m.healAura) continue;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (e === m) continue;
      if (e.healAura) continue;
      if (e.hp >= e.maxHp) continue;
      if (distSq(e.pos, m.pos) > r2) continue;
      e.hp = Math.min(e.maxHp, e.hp + HEAL_AURA_RATE * dt);
      // Sparse green spark on healed allies — every ~20 ticks per ally
      // so the ambient sparkle reads without flooding the particle pool.
      if (Math.random() < 0.05) {
        spawnParticles(world, e.pos, 1, "#7eff8a", [0.4, 1.4], 0.45);
      }
    }
  }
};
