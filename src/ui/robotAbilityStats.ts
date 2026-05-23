import type { RobotVariantSpec } from "../sim/robotVariants";

export type AbilitySlot = 0 | 1 | 2 | 3;

// Minimal translate signature so this module stays free of an i18next
// import; callers pass the `t` from useTranslation().
type TFn = (key: string, opts?: Record<string, unknown>) => string;

const signedPct = (m: number) => {
  const delta = Math.round((m - 1) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}%`;
};

export const formatAbilityStats = (spec: RobotVariantSpec, slot: AbilitySlot, t: TFn): string[] => {
  const a = spec.abilities[slot];
  if (a.type === "dash") {
    const lines = [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.lunge", { s: a.duration.toFixed(2) }),
      t("robotShop.as.speed", { v: a.speed.toFixed(1) }),
      t("robotShop.as.iframes"),
    ];
    if (a.nextShotCrit) {
      lines.push(
        t("robotShop.as.nextShot", { mul: a.nextShotCrit.mul.toFixed(1) }) +
          (a.nextShotCrit.pierce ? t("robotShop.as.pierces") : ""),
      );
    }
    if (a.endChain) {
      lines.push(
        t("robotShop.as.endChain", {
          hops: a.endChain.hops,
          dmg: a.endChain.damagePerHop,
          type: t(`damageTypes.${a.endChain.damageType}`),
        }),
      );
    }
    if (a.landingBlast) {
      lines.push(
        t("robotShop.as.landBlast", {
          dmg: a.landingBlast.damage,
          radius: a.landingBlast.radius.toFixed(1),
        }),
      );
    }
    return lines;
  }
  if (a.type === "burst") {
    const lines = [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.damage", { dmg: a.damage }),
      t("robotShop.as.radius", { radius: a.radius.toFixed(1) }),
    ];
    if (a.chainHops) {
      lines.push(
        t("robotShop.as.chainHops", { hops: a.chainHops.hops, dmg: a.chainHops.damagePerHop }),
      );
    }
    if (a.burn) {
      lines.push(
        t("robotShop.as.burn", { total: a.burn.totalDamage, dur: a.burn.duration.toFixed(1) }),
      );
    }
    if (a.knockback) {
      lines.push(t("robotShop.as.push", { push: a.knockback.pathPush.toFixed(1) }));
    }
    return lines;
  }
  if (a.type === "storm") {
    return [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.durRadius", { dur: a.duration.toFixed(1), radius: a.radius.toFixed(1) }),
      t("robotShop.as.arcs", {
        arcs: a.arcsPerTick,
        tick: a.tickInterval.toFixed(2),
        dmg: a.damagePerArc,
      }),
    ];
  }
  if (a.type === "flameRings") {
    const lines = [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.rings", { count: a.ringCount, interval: a.ringInterval.toFixed(1) }),
      t("robotShop.as.radiusExpand", {
        radius: a.maxRadius.toFixed(1),
        speed: a.expandSpeed.toFixed(1),
      }),
      t("robotShop.as.dmgPerRing", { dmg: a.damagePerRing }),
    ];
    if (a.burn) {
      lines.push(
        t("robotShop.as.burn", { total: a.burn.totalDamage, dur: a.burn.duration.toFixed(1) }),
      );
    }
    return lines;
  }
  if (a.type === "frenzy") {
    return [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.active", { dur: a.duration.toFixed(1) }),
      t("robotShop.as.damageMul", { mul: a.damageMul.toFixed(2) }),
      t("robotShop.as.fireRateMul", { mul: a.fireRateMul.toFixed(1) }),
    ];
  }
  if (a.type === "buff") {
    const lines = [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.active", { dur: a.duration.toFixed(1) }),
    ];
    if (a.damageMul !== 1) lines.push(t("robotShop.as.damagePct", { pct: signedPct(a.damageMul) }));
    if (a.fireRateMul !== 1)
      lines.push(t("robotShop.as.fireRatePct", { pct: signedPct(a.fireRateMul) }));
    if (a.speedMul !== 1) lines.push(t("robotShop.as.speedPct", { pct: signedPct(a.speedMul) }));
    if (a.rangeMul && a.rangeMul !== 1)
      lines.push(t("robotShop.as.rangePct", { pct: signedPct(a.rangeMul) }));
    if (a.damageResist > 0)
      lines.push(t("robotShop.as.damageResist", { pct: Math.round(a.damageResist * 100) }));
    if (a.igniteOnHit) {
      lines.push(
        t("robotShop.as.ignite", {
          total: a.igniteOnHit.totalDamage,
          dur: a.igniteOnHit.duration.toFixed(1),
        }),
      );
    }
    return lines;
  }
  if (a.type === "killshot") {
    return [
      t("robotShop.as.cd", { s: a.cooldown.toFixed(1) }),
      t("robotShop.as.rangeCharge", { range: a.range.toFixed(1), charge: a.chargeTime.toFixed(1) }),
      t("robotShop.as.direct", { dmg: a.damage }),
      t("robotShop.as.splash", { splash: a.splashDamage, radius: a.splashRadius.toFixed(1) }),
    ];
  }
  return [];
};
