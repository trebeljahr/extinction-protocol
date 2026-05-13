import { advanceAlongPath, samplePath, smoothDirection } from "./path";
import type { World } from "./types";
import { addShake, BOSS_VARIANT_CHILD, BOSS_VARIANT_STATS, emit, spawnEnemy } from "./world";

export const updateEnemies = (world: World, dt: number) => {
  // Collect matriarch child-spawn requests during the tick. Deferred so
  // we don't mutate world.enemies while iterating it — the new child
  // will be picked up by the next tick instead.
  type DeferredChild = {
    kind: import("./types").EnemyKind;
    pathIndex: number;
    hpMul: number;
    segment: number;
    segmentT: number;
    spawnIndex: number;
    spawnCount: number;
  };
  const childSpawns: DeferredChild[] = [];

  for (const e of world.enemies) {
    if (!e.alive) continue;

    // Matriarch child-spawn — variant matriarchs drip their namesake
    // species behind them every BOSS_VARIANT_CHILD interval. Disabled
    // while she's slowed (cryo "freezes" her brood in place) so cold
    // becomes a way to suppress the spawn stream, not just slow her HP.
    if (
      e.kind === "boss" &&
      e.bossVariant !== undefined &&
      e.childSpawnAt !== undefined &&
      world.time >= e.childSpawnAt &&
      world.time >= e.slowUntil
    ) {
      const cfg = BOSS_VARIANT_CHILD[e.bossVariant];
      if (cfg) {
        // Inherit the wave's hpMul from the matriarch herself so children
        // scale with level difficulty without us having to thread the
        // multiplier through Enemy. Late-game raptor children should be
        // late-game-tough, not L5 chaff.
        const variantHp = BOSS_VARIANT_STATS[e.bossVariant].hp;
        const spawnCount = Math.max(1, cfg.count ?? 1);
        for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex++) {
          childSpawns.push({
            kind: cfg.kind,
            pathIndex: e.pathIndex,
            hpMul: e.maxHp / variantHp,
            segment: e.segment,
            segmentT: e.segmentT,
            spawnIndex,
            spawnCount,
          });
        }
        e.childSpawnAt = world.time + cfg.interval;
      }
    }

    if (world.time >= e.slowUntil && e.slowFactor !== 1) {
      e.slowFactor = 1;
    }

    // Frost accumulates while slowed (only cryo applies slow today) and
    // decays back to 0 once free. The visual layer reads this to tint the
    // model from base color toward white-blue as it builds up.
    if (world.time < e.slowUntil) {
      if (e.frost < 1) e.frost = Math.min(1, e.frost + dt * 0.7);
    } else if (e.frost > 0) {
      e.frost = Math.max(0, e.frost - dt * 0.35);
    }

    const effectiveSpeed = e.speed * e.slowFactor;
    const path = world.paths[e.pathIndex];
    const adv = advanceAlongPath(path, e.segment, e.segmentT, effectiveSpeed * dt);
    e.segment = adv.segment;
    e.segmentT = adv.segmentT;

    // Nudge off the centerline so enemies spread across the lane. The
    // normal is the segment direction rotated 90° — computed per-tick
    // so the offset tracks the path through corners.
    if (e.lateralOffset !== 0 && !adv.finished) {
      const dir = smoothDirection(path, adv.segment, adv.segmentT);
      if (dir.x * dir.x + dir.y * dir.y > 1e-12) {
        e.pos = {
          x: adv.pos.x + -dir.y * e.lateralOffset,
          y: adv.pos.y + dir.x * e.lateralOffset,
        };
      } else {
        e.pos = adv.pos;
      }
    } else {
      e.pos = adv.pos;
    }

    if (adv.finished) {
      // Debug invincibility absorbs the leak — enemy still despawns at the
      // exit but lives stay at startLives, the shake/event still fire so
      // the leak is visually unmistakable.
      if (!world.invincible) world.lives -= e.damage;
      e.alive = false;
      emit(world, { type: "life-lost" });
      // Slight jolt so the hit registers — previous 0.18 mag with decay 6
      // faded in two frames and was easy to miss. Scales with the enemy's
      // damage so a titan at the gate hits harder than a lone raptor.
      const mag = 0.32 + Math.min(0.28, e.damage * 0.06);
      addShake(world, mag, 3.5);
    }
  }
  // Swap-and-pop dead enemies in place; keep enemyById in sync.
  const arr = world.enemies;
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const e = arr[r];
    if (e.alive) {
      arr[w++] = e;
    } else {
      world.enemyById.delete(e.id);
    }
  }
  arr.length = w;

  // Drop matriarch-spawned children at her current path position so
  // they read as trailing behind her rather than teleporting in at the
  // path origin. Done after the swap-and-pop above so the new entries
  // don't get scanned by the dead-cull pass on this same tick.
  for (const c of childSpawns) {
    const child = spawnEnemy(world, c.kind, { pathIndex: c.pathIndex, hpMul: c.hpMul });
    // Plant the child immediately near the matriarch instead of leaving
    // the default path-start position for a frame. The progress backoff
    // plus side spread makes raptor broods look like they are spilling
    // out around her body rather than being teleported from spawn zero.
    let segment = c.segment;
    let segmentT = c.segmentT - (0.16 + c.spawnIndex * 0.12);
    while (segmentT < 0 && segment > 0) {
      segment -= 1;
      segmentT += 1;
    }
    child.segment = segment;
    child.segmentT = Math.max(0, segmentT);
    const sideSpread = c.spawnCount > 1 ? (c.spawnIndex - (c.spawnCount - 1) / 2) * 0.28 : 0;
    child.lateralOffset += sideSpread;
    const path = world.paths[c.pathIndex] ?? world.paths[0];
    const basePos = samplePath(path, child.segment, child.segmentT);
    const dir = smoothDirection(path, child.segment, child.segmentT);
    if (dir.x * dir.x + dir.y * dir.y > 1e-12) {
      child.pos = {
        x: basePos.x + -dir.y * child.lateralOffset,
        y: basePos.y + dir.x * child.lateralOffset,
      };
    } else {
      child.pos = basePos;
    }
  }
};
