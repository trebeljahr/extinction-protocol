import { type FC, useState } from "react";
import { isDebug } from "../debug";
import {
  levelForXp,
  ROBOT_MAX_LEVEL,
  ROBOT_POINTS_PER_LEVEL,
  ROBOT_SKILL_MAX_RANK,
  ROBOT_SKILL_TREE,
  ROBOT_TREE_TOTAL_POINTS,
  type RobotSkillId,
  type RobotSkillNode,
  robotSkillPointsAvailable,
  xpProgressInLevel,
} from "../sim/robotSkills";
import { ROBOT_SPECS, type RobotVariantSpec, robotAbilityDamageType } from "../sim/robotVariants";
import type { RobotVariant } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { IconBoot, IconCore, IconCrosshair, IconShield, type MenuIconProps } from "./MenuIcons";
import { MenuOverlay } from "./MenuOverlay";
import { RobotDiorama } from "./RobotDiorama";
import { RobotPreview } from "./RobotPreview";

const ROSTER: RobotVariant[] = ["george", "leela", "mike", "stan"];

const SKILL_ICONS: Record<RobotSkillId, FC<MenuIconProps>> = {
  vitality: IconShield,
  firepower: IconCrosshair,
  mobility: IconBoot,
  ultimate: IconCore,
};

const RankPips = ({
  rank,
  available,
  onClick,
}: {
  rank: number;
  available: number;
  onClick: (target: number) => void;
}) => (
  <div className="robot-skill-pips">
    {Array.from({ length: ROBOT_SKILL_MAX_RANK }).map((_, i) => {
      const tier = i + 1;
      const filled = tier <= rank;
      const target = filled && tier === rank ? rank - 1 : tier;
      const wouldSpend = Math.max(0, tier - rank);
      const affordable = wouldSpend <= available;
      const disabled = !filled && !affordable;
      return (
        <button
          key={`pip-${tier}`}
          type="button"
          className={`robot-skill-pip ${filled ? "filled" : affordable ? "affordable" : "locked"}`}
          onClick={() => !disabled && onClick(target)}
          disabled={disabled}
          aria-label={filled ? `Rank ${tier} (click to refund)` : `Upgrade to rank ${tier}`}
          title={filled ? `Rank ${tier} (click to refund)` : `Upgrade to rank ${tier}`}
        />
      );
    })}
  </div>
);

const SkillRow = ({
  variant,
  node,
  rank,
  available,
}: {
  variant: RobotVariant;
  node: RobotSkillNode;
  rank: number;
  available: number;
}) => {
  const setRank = useGame((s) => s.setRobotSkillRank);
  const Icon = SKILL_ICONS[node.id];
  const nextDesc = rank < ROBOT_SKILL_MAX_RANK ? node.rankDesc[rank] : null;
  const currentDesc = rank > 0 ? node.rankDesc[rank - 1] : null;
  return (
    <div className={`robot-skill-card ${rank > 0 ? "invested" : ""}`}>
      <div className="robot-skill-icon">
        <Icon size={22} />
      </div>
      <div className="robot-skill-body">
        <div className="robot-skill-head">
          <span className="robot-skill-name">{node.name}</span>
          <RankPips
            rank={rank}
            available={available}
            onClick={(target) => setRank(variant, node.id, target)}
          />
        </div>
        <div className="robot-skill-desc">
          {currentDesc ? (
            <span className="robot-skill-current">{currentDesc}</span>
          ) : (
            <span className="robot-skill-current dim">{node.blurb}</span>
          )}
          {nextDesc && (
            <>
              <span className="robot-skill-arrow">→</span>
              <span className="robot-skill-next">{nextDesc}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const RosterCard = ({
  variant,
  activeRobot,
  unlocked,
  onSelect,
}: {
  variant: RobotVariant;
  activeRobot: RobotVariant;
  unlocked: boolean;
  onSelect: (v: RobotVariant) => void;
}) => {
  const spec = ROBOT_SPECS[variant];
  const progress = useGame((s) => s.progress);
  const xp = progress.robotXp[variant] ?? 0;
  const level = levelForXp(xp);
  const active = activeRobot === variant;
  return (
    <button
      type="button"
      className={`robot-roster-card ${active ? "active" : ""} ${unlocked ? "" : "locked"}`}
      data-variant={variant}
      onClick={() => onSelect(variant)}
      aria-label={`View ${spec.label}`}
    >
      <div className="robot-roster-portrait">
        <RobotPreview variant={variant} />
        {active && <span className="robot-roster-active-tag">Active</span>}
        {!unlocked && (
          <span className="robot-roster-lock">
            <span className="robot-roster-lock-cost">
              {isDebug ? "FREE" : `⚡ ${spec.unlockBolts}`}
            </span>
            <span className="robot-roster-lock-label">LOCKED</span>
          </span>
        )}
      </div>
      <div className="robot-roster-meta">
        <div className="robot-roster-name">{spec.label}</div>
        <div className="robot-roster-callsign">{spec.callsign}</div>
        <div className="robot-roster-row">
          <span
            className="dmg-tag inline-flex items-center gap-1 text-[10px]"
            style={{
              color: DAMAGE_TYPE_COLOR[spec.damageType],
              borderColor: DAMAGE_TYPE_COLOR[spec.damageType],
            }}
          >
            {DAMAGE_TYPE_LABEL[spec.damageType]}
          </span>
          {unlocked && (
            <span className="robot-roster-level">
              Lv {level}
              <span className="robot-roster-level-max">/{ROBOT_MAX_LEVEL}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

type AbilitySlot = 0 | 1 | 2 | 3;

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
      `${a.boltsPerTick} bolts/${a.tickInterval.toFixed(2)}s · ${a.damagePerBolt} each`,
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

const formatAutoAttack = (spec: RobotVariantSpec): string[] => {
  const lines = [
    `Damage ${spec.damage} · Fire rate ${spec.fireRate.toFixed(1)}/s · Range ${spec.range.toFixed(1)}`,
  ];
  if (spec.attackSplashRadius > 0) {
    lines.push(`Splash radius ${spec.attackSplashRadius.toFixed(1)} per shot`);
  } else if (spec.attackTracer) {
    lines.push("Hitscan tracer beam — no projectile travel");
  } else {
    lines.push("Single-target projectile");
  }
  if (spec.attackChain) {
    lines.push(
      `Chains to ${spec.attackChain.hops} nearby (${spec.attackChain.damagePerHop} bonus damage)`,
    );
  }
  return lines;
};

const AbilityCard = ({
  spec,
  slot,
  expanded,
  onToggle,
}: {
  spec: RobotVariantSpec;
  slot: AbilitySlot;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const label = spec.abilityLabels[slot];
  const glyph = spec.abilityGlyphs[slot];
  const blurb = spec.abilityBlurbs[slot + 1];
  const damageType = robotAbilityDamageType(spec, slot);
  return (
    <div className={`robot-ability-card ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="robot-ability-summary"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="robot-ability-glyph" aria-hidden>
          {glyph}
        </span>
        <span className="robot-ability-name">{label}</span>
        <span
          className="robot-ability-type dmg-tag"
          style={{
            color: DAMAGE_TYPE_COLOR[damageType],
            borderColor: DAMAGE_TYPE_COLOR[damageType],
          }}
        >
          <DamageIcon type={damageType} size={10} title={DAMAGE_TYPE_LABEL[damageType]} />
          {DAMAGE_TYPE_LABEL[damageType]}
        </span>
        <span className="robot-ability-toggle" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded && (
        <div className="robot-ability-detail">
          <p className="robot-ability-blurb">{blurb}</p>
          <ul className="robot-ability-stats">
            {formatAbilityStats(spec, slot).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const AutoAttackCard = ({
  spec,
  expanded,
  onToggle,
}: {
  spec: RobotVariantSpec;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div className={`robot-ability-card ${expanded ? "expanded" : ""}`}>
    <button
      type="button"
      className="robot-ability-summary"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="robot-ability-glyph" aria-hidden>
        ◉
      </span>
      <span className="robot-ability-name">Basic Attack</span>
      <span
        className="robot-ability-type dmg-tag"
        style={{
          color: DAMAGE_TYPE_COLOR[spec.damageType],
          borderColor: DAMAGE_TYPE_COLOR[spec.damageType],
        }}
      >
        <DamageIcon type={spec.damageType} size={10} title={DAMAGE_TYPE_LABEL[spec.damageType]} />
        {DAMAGE_TYPE_LABEL[spec.damageType]}
      </span>
      <span className="robot-ability-toggle" aria-hidden>
        {expanded ? "−" : "+"}
      </span>
    </button>
    {expanded && (
      <div className="robot-ability-detail">
        <p className="robot-ability-blurb">{spec.abilityBlurbs[0]}</p>
        <ul className="robot-ability-stats">
          {formatAutoAttack(spec).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const RobotDetail = ({
  variant,
  availableBolts,
  activeRobot,
  unlocked,
  onBack,
}: {
  variant: RobotVariant;
  availableBolts: number;
  activeRobot: RobotVariant;
  unlocked: boolean;
  onBack: () => void;
}) => {
  const spec = ROBOT_SPECS[variant];
  const progress = useGame((s) => s.progress);
  const unlockRobot = useGame((s) => s.unlockRobot);
  const setActiveRobot = useGame((s) => s.setActiveRobot);
  const resetSkills = useGame((s) => s.resetRobotSkills);
  // `auto` = the basic-attack card; 0..3 = QWER ability cards.
  const [openAbility, setOpenAbility] = useState<"auto" | AbilitySlot | null>(null);

  const xp = progress.robotXp[variant] ?? 0;
  const ranks = progress.robotSkills[variant];
  const level = levelForXp(xp);
  const { into, need, maxed } = xpProgressInLevel(xp);
  const pts = robotSkillPointsAvailable(xp, ranks);
  const active = activeRobot === variant;
  const canUnlock = !unlocked && (isDebug || availableBolts >= spec.unlockBolts);
  const xpPct = maxed ? 1 : need > 0 ? into / need : 0;
  const investedTotal = pts.spent;

  return (
    <div className="robot-detail">
      <button
        type="button"
        className="robot-detail-back"
        onClick={onBack}
        aria-label="Back to roster"
      >
        ← Roster
      </button>
      <div className="robot-detail-grid">
        <div className="robot-detail-preview">
          <RobotDiorama variant={variant} />
        </div>
        <div className="robot-detail-info">
          <div className="robot-detail-head">
            <div className="robot-detail-tag-row">
              <span className="robot-detail-callsign">{spec.callsign}</span>
              <span
                className="dmg-tag inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: DAMAGE_TYPE_COLOR[spec.damageType],
                  borderColor: DAMAGE_TYPE_COLOR[spec.damageType],
                }}
              >
                {DAMAGE_TYPE_LABEL[spec.damageType]}
              </span>
              {active && <span className="robot-detail-active">Active</span>}
            </div>
            <p className="robot-detail-blurb">{spec.blurb}</p>
          </div>

          <div className="robot-detail-stats">
            <div>
              <span>HP</span> {spec.maxHp}
            </div>
            <div>
              <span>SPD</span> {spec.speed}
            </div>
            <div>
              <span>DMG</span> {spec.damage}
            </div>
            <div>
              <span>RNG</span> {spec.range}
            </div>
          </div>

          <div className="robot-ability-list">
            <AutoAttackCard
              spec={spec}
              expanded={openAbility === "auto"}
              onToggle={() => setOpenAbility(openAbility === "auto" ? null : "auto")}
            />
            {([0, 1, 2, 3] as const).map((slot) => (
              <AbilityCard
                key={slot}
                spec={spec}
                slot={slot}
                expanded={openAbility === slot}
                onToggle={() => setOpenAbility(openAbility === slot ? null : slot)}
              />
            ))}
          </div>

          {unlocked ? (
            <>
              <div className="robot-level-block">
                <div className="robot-level-head">
                  <span className="robot-level-lvl">
                    Lv {level}
                    <span className="robot-level-max">/ {ROBOT_MAX_LEVEL}</span>
                  </span>
                  <span className="robot-level-xp">{maxed ? "MAX" : `${into} / ${need} XP`}</span>
                </div>
                <div className="robot-level-bar">
                  <div
                    className={`robot-level-fill ${maxed ? "maxed" : ""}`}
                    style={{ width: `${xpPct * 100}%` }}
                  />
                </div>
                <div className="robot-level-foot">
                  <span>
                    {ROBOT_POINTS_PER_LEVEL} skill point per level · earned {pts.earned}
                    {pts.earned >= ROBOT_TREE_TOTAL_POINTS ? " (tree max)" : ""}
                  </span>
                  <span className="robot-level-points">
                    {pts.available} pt{pts.available === 1 ? "" : "s"} to spend
                  </span>
                </div>
              </div>

              <div className="robot-skill-tree">
                {ROBOT_SKILL_TREE.map((node) => (
                  <SkillRow
                    key={node.id}
                    variant={variant}
                    node={node as RobotSkillNode}
                    rank={(ranks?.[node.id as RobotSkillId] ?? 0) as number}
                    available={pts.available}
                  />
                ))}
                {investedTotal > 0 && (
                  <button
                    type="button"
                    className="robot-skill-refund"
                    onClick={() => resetSkills(variant)}
                    title={`Refund all ${investedTotal} pt${investedTotal === 1 ? "" : "s"}`}
                  >
                    ↺ Refund {investedTotal}
                  </button>
                )}
              </div>

              {!active && (
                <button
                  type="button"
                  className="btn btn-blue text-sm py-2"
                  onClick={() => setActiveRobot(variant)}
                >
                  Set Active
                </button>
              )}
            </>
          ) : (
            <div className="border-t border-border-faint pt-3 flex items-center gap-3">
              <span className="text-[12px] text-fg-muted">Unlock cost</span>
              <span className="text-blue text-base font-bold tabular-nums">
                {isDebug ? "FREE" : `⚡ ${spec.unlockBolts}`}
              </span>
              <button
                type="button"
                className={`ml-auto btn ${canUnlock ? "btn-blue" : "btn-ghost"} text-sm py-2 px-4`}
                disabled={!canUnlock}
                onClick={() => unlockRobot(variant)}
                title={
                  canUnlock
                    ? isDebug
                      ? "Unlock free in debug"
                      : "Unlock"
                    : `Need ${spec.unlockBolts - availableBolts} more bolts`
                }
              >
                {canUnlock ? "Unlock" : "Locked"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const RobotShop = () => {
  const open = useGame((s) => s.robotShopOpen);
  const setOpen = useGame((s) => s.setRobotShopOpen);
  const progress = useGame((s) => s.progress);
  const resetAll = useGame((s) => s.resetAllRobotSkills);
  const [selected, setSelected] = useState<RobotVariant | null>(null);
  if (!open) return null;
  const availableBolts = progress.bolts;
  const anyInvested = Object.values(progress.robotSkills).some(
    (r) => r && Object.keys(r).length > 0,
  );

  const handleClose = () => {
    setSelected(null);
    setOpen(false);
  };

  return (
    <MenuOverlay
      title={selected ? ROBOT_SPECS[selected].label : "Pilot Roster"}
      subtitle={selected ? ROBOT_SPECS[selected].callsign : null}
      onClose={handleClose}
      cardClassName="!w-[min(1100px,calc(100vw-24px))] !max-w-none !min-w-0 !px-4 sm:!px-6 md:!px-8"
    >
      <div className="robot-shop-panel w-full">
        {selected ? (
          <RobotDetail
            variant={selected}
            availableBolts={availableBolts}
            activeRobot={progress.activeRobot}
            unlocked={!!progress.robotUnlocks[selected]}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="robot-roster-grid">
            {ROSTER.map((variant) => (
              <RosterCard
                key={variant}
                variant={variant}
                activeRobot={progress.activeRobot}
                unlocked={!!progress.robotUnlocks[variant]}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </div>
      <RobotShopToolbar
        bolts={availableBolts}
        canRefundAll={!selected && anyInvested}
        onRefundAll={resetAll}
      />
    </MenuOverlay>
  );
};

const RobotShopToolbar = ({
  bolts,
  canRefundAll,
  onRefundAll,
}: {
  bolts: number;
  canRefundAll: boolean;
  onRefundAll: () => void;
}) => (
  <div className="lab-stars-toolbar">
    <span className="lab-stars-chip" title={`${bolts} bolts gathered`}>
      <span aria-hidden style={{ color: "#5ad6ff", fontSize: 16, lineHeight: 1 }}>
        ⚡
      </span>
      <span className="lab-stars-num tabular-nums">{bolts}</span>
      <span className="lab-stars-lbl">bolts</span>
    </span>
    {canRefundAll && (
      <button type="button" className="lab-stars-refund" onClick={onRefundAll}>
        ↺ Refund all
      </button>
    )}
  </div>
);
