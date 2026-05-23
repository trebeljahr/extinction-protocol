import type { RobotVariantSpec } from "../sim/robotVariants";
import { DAMAGE_TYPE_LABEL } from "../sim/world";

export type AbilitySlot = 0 | 1 | 2 | 3;

const signedPct = (m: number) => {
  const delta = Math.round((m - 1) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}%`;
};

export const formatAbilityStats = (spec: RobotVariantSpec, slot: AbilitySlot): string[] => {
  const a = spec.abilities[slot];
  if (a.type === "dash") {
    const lines = [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.duration.toFixed(2)}s lunge`,
      `Speed ${a.speed.toFixed(1)}`,
      "I-frames",
    ];
    if (a.nextShotCrit) {
      lines.push(
        `Next shot x${a.nextShotCrit.mul.toFixed(1)}${a.nextShotCrit.pierce ? " · pierces" : ""}`,
      );
    }
    if (a.endChain) {
      lines.push(
        `End chain ${a.endChain.hops}x${a.endChain.damagePerHop} ${DAMAGE_TYPE_LABEL[a.endChain.damageType]}`,
      );
    }
    if (a.landingBlast) {
      lines.push(
        `Land blast ${a.landingBlast.damage} · ${a.landingBlast.radius.toFixed(1)} radius`,
      );
    }
    return lines;
  }
  if (a.type === "burst") {
    const lines = [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.damage} damage`,
      `${a.radius.toFixed(1)} radius`,
    ];
    if (a.chainHops) {
      lines.push(`${a.chainHops.hops} chain hops · ${a.chainHops.damagePerHop} each`);
    }
    if (a.burn) {
      lines.push(`Burn ${a.burn.totalDamage}/${a.burn.duration.toFixed(1)}s`);
    }
    if (a.knockback) {
      lines.push(`Push ${a.knockback.pathPush.toFixed(1)} path`);
    }
    return lines;
  }
  if (a.type === "storm") {
    return [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.duration.toFixed(1)}s · ${a.radius.toFixed(1)} radius`,
      `${a.arcsPerTick} arcs/${a.tickInterval.toFixed(2)}s · ${a.damagePerArc} each`,
    ];
  }
  if (a.type === "flameRings") {
    const lines = [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.ringCount} rings · ${a.ringInterval.toFixed(1)}s apart`,
      `${a.maxRadius.toFixed(1)} radius · ${a.expandSpeed.toFixed(1)} u/s`,
      `${a.damagePerRing} damage/ring`,
    ];
    if (a.burn) {
      lines.push(`Burn ${a.burn.totalDamage}/${a.burn.duration.toFixed(1)}s`);
    }
    return lines;
  }
  if (a.type === "frenzy") {
    return [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.duration.toFixed(1)}s active`,
      `Damage x${a.damageMul.toFixed(2)}`,
      `Fire rate x${a.fireRateMul.toFixed(1)}`,
    ];
  }
  if (a.type === "buff") {
    const lines = [`CD ${a.cooldown.toFixed(1)}s`, `${a.duration.toFixed(1)}s active`];
    if (a.damageMul !== 1) lines.push(`Damage ${signedPct(a.damageMul)}`);
    if (a.fireRateMul !== 1) lines.push(`Fire rate ${signedPct(a.fireRateMul)}`);
    if (a.speedMul !== 1) lines.push(`Speed ${signedPct(a.speedMul)}`);
    if (a.rangeMul && a.rangeMul !== 1) lines.push(`Range ${signedPct(a.rangeMul)}`);
    if (a.damageResist > 0) lines.push(`Damage resist ${Math.round(a.damageResist * 100)}%`);
    if (a.igniteOnHit) {
      lines.push(`Ignite ${a.igniteOnHit.totalDamage}/${a.igniteOnHit.duration.toFixed(1)}s`);
    }
    return lines;
  }
  if (a.type === "killshot") {
    return [
      `CD ${a.cooldown.toFixed(1)}s`,
      `${a.range.toFixed(1)} range · ${a.chargeTime.toFixed(1)}s charge`,
      `${a.damage} direct`,
      `${a.splashDamage} splash · ${a.splashRadius.toFixed(1)} radius`,
    ];
  }
  return [];
};
