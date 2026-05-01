import type { World } from "./types";
import { distSq } from "./vec2";
import {
  MEDIC_HEAL_RANGE,
  MEDIC_HEAL_RATE,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_RATE,
  spawnParticles,
} from "./world";

// Shield regen + medic heal-aura tick. Both are continuous defensive
// effects that consume the same enemy list, so colocating them avoids a
// second pass through `world.enemies` per tick.

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

  // Healers — find each medic and tick HP for nearby allies. Quadratic
  // in (medics × enemies), but medic counts stay small (handfuls per
  // wave) so the total cost is fine vs. building a spatial index.
  const r2 = MEDIC_HEAL_RANGE * MEDIC_HEAL_RANGE;
  for (const m of world.enemies) {
    if (!m.alive) continue;
    if (m.kind !== "medic") continue;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (e === m) continue;
      // Medics don't heal each other — keeps healer-stacks from being
      // immortal. Players still need to focus medics down individually.
      if (e.kind === "medic") continue;
      if (e.hp >= e.maxHp) continue;
      if (distSq(e.pos, m.pos) > r2) continue;
      e.hp = Math.min(e.maxHp, e.hp + MEDIC_HEAL_RATE * dt);
      // Sparse green spark on healed allies — every ~20 ticks per ally
      // so the ambient sparkle reads without flooding the particle pool.
      if (Math.random() < 0.05) {
        spawnParticles(world, e.pos, 1, "#7eff8a", [0.4, 1.4], 0.45);
      }
    }
  }
};
