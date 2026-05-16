import { type FC, useState } from "react";
import { totalStars } from "../progress";
import {
  HERO_MAX_LEVEL,
  HERO_POINTS_PER_LEVEL,
  HERO_SKILL_MAX_RANK,
  HERO_SKILL_TREE,
  type HeroSkillId,
  type HeroSkillNode,
  heroSkillPointsAvailable,
  levelForXp,
  xpProgressInLevel,
} from "../sim/heroSkills";
import { HERO_SPECS, type HeroVariantSpec } from "../sim/heroVariants";
import { spentMetaStars } from "../sim/metaSkills";
import type { HeroVariant } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { useGame } from "../store";
import { HeroDiorama } from "./HeroDiorama";
import { HeroPreview } from "./HeroPreview";
import { IconBoot, IconCore, IconCrosshair, IconShield, type MenuIconProps } from "./MenuIcons";
import { MenuOverlay } from "./MenuOverlay";

const ROSTER: HeroVariant[] = ["george", "leela", "mike", "stan"];

const SKILL_ICONS: Record<HeroSkillId, FC<MenuIconProps>> = {
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
  <div className="hero-skill-pips">
    {Array.from({ length: HERO_SKILL_MAX_RANK }).map((_, i) => {
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
          className={`hero-skill-pip ${filled ? "filled" : affordable ? "affordable" : "locked"}`}
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
  variant: HeroVariant;
  node: HeroSkillNode;
  rank: number;
  available: number;
}) => {
  const setRank = useGame((s) => s.setHeroSkillRank);
  const Icon = SKILL_ICONS[node.id];
  const nextDesc = rank < HERO_SKILL_MAX_RANK ? node.rankDesc[rank] : null;
  const currentDesc = rank > 0 ? node.rankDesc[rank - 1] : null;
  return (
    <div className={`hero-skill-card ${rank > 0 ? "invested" : ""}`}>
      <div className="hero-skill-icon">
        <Icon size={22} />
      </div>
      <div className="hero-skill-body">
        <div className="hero-skill-head">
          <span className="hero-skill-name">{node.name}</span>
          <RankPips
            rank={rank}
            available={available}
            onClick={(target) => setRank(variant, node.id, target)}
          />
        </div>
        <div className="hero-skill-desc">
          {currentDesc ? (
            <span className="hero-skill-current">{currentDesc}</span>
          ) : (
            <span className="hero-skill-current dim">{node.blurb}</span>
          )}
          {nextDesc && (
            <>
              <span className="hero-skill-arrow">→</span>
              <span className="hero-skill-next">{nextDesc}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const RosterCard = ({
  variant,
  activeHero,
  unlocked,
  onSelect,
}: {
  variant: HeroVariant;
  activeHero: HeroVariant;
  unlocked: boolean;
  onSelect: (v: HeroVariant) => void;
}) => {
  const spec = HERO_SPECS[variant];
  const progress = useGame((s) => s.progress);
  const xp = progress.heroXp[variant] ?? 0;
  const level = levelForXp(xp);
  const active = activeHero === variant;
  return (
    <button
      type="button"
      className={`hero-roster-card ${active ? "active" : ""} ${unlocked ? "" : "locked"}`}
      data-variant={variant}
      onClick={() => onSelect(variant)}
      aria-label={`View ${spec.label}`}
    >
      <div className="hero-roster-portrait">
        <HeroPreview variant={variant} />
        {active && <span className="hero-roster-active-tag">Active</span>}
        {!unlocked && (
          <span className="hero-roster-lock">
            <span className="hero-roster-lock-cost">★ {spec.unlockStars}</span>
            <span className="hero-roster-lock-label">LOCKED</span>
          </span>
        )}
      </div>
      <div className="hero-roster-meta">
        <div className="hero-roster-name">{spec.label}</div>
        <div className="hero-roster-callsign">{spec.callsign}</div>
        <div className="hero-roster-row">
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
            <span className="hero-roster-level">
              Lv {level}
              <span className="hero-roster-level-max">/{HERO_MAX_LEVEL}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const formatAbilityStats = (spec: HeroVariantSpec, slot: 0 | 1 | 2): string[] => {
  const a = spec.abilities[slot];
  if (a.type === "dash") {
    return [
      `Cooldown ${a.cooldown.toFixed(1)}s`,
      `Duration ${a.duration.toFixed(2)}s`,
      `Speed ${a.speed.toFixed(1)}`,
      "Grants i-frames during lunge",
    ];
  }
  if (a.type === "burst") {
    return [
      `Cooldown ${a.cooldown.toFixed(1)}s`,
      `Damage ${a.damage}`,
      `Radius ${a.radius.toFixed(1)}`,
      `Type ${DAMAGE_TYPE_LABEL[a.damageType]}`,
    ];
  }
  if (a.type === "barrage") {
    return [
      `Cooldown ${a.cooldown.toFixed(1)}s`,
      `Shells ${a.count}`,
      `Damage ${a.damage} × splash ${a.splashRadius.toFixed(1)}`,
      `Range ${a.range.toFixed(1)} · ${DAMAGE_TYPE_LABEL[a.damageType]}`,
    ];
  }
  if (a.type === "mark") {
    return [
      `Cooldown ${a.cooldown.toFixed(1)}s`,
      `Duration ${a.duration.toFixed(1)}s`,
      `Marked targets take +${Math.round((a.dmgMul - 1) * 100)}% damage`,
    ];
  }
  return [
    `Cooldown ${a.cooldown.toFixed(1)}s`,
    `Total damage ${a.totalDamage}`,
    `Duration ${a.duration.toFixed(1)}s · Range ${a.range.toFixed(1)}`,
    `Type ${DAMAGE_TYPE_LABEL[a.damageType]}`,
  ];
};

const ABILITY_BLURB: Record<string, string> = {
  dash: "Forward dash. Hero is invulnerable mid-lunge — use it to break grapple or close range.",
  burst: "Instant radial blast centered on the hero. Best when ringed by enemies.",
  barrage: "Calls a saturation strike of shells over a target area. Each shell splashes.",
  mark: "Marks the nearest cluster of enemies; marked targets take bonus damage from all sources.",
  incinerate:
    "Sustained flame cone in front of the hero. Total damage spread evenly over the duration.",
};

const AbilityCard = ({
  spec,
  slot,
  expanded,
  onToggle,
}: {
  spec: HeroVariantSpec;
  slot: 0 | 1 | 2;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const label = spec.abilityLabels[slot];
  const glyph = spec.abilityGlyphs[slot];
  const a = spec.abilities[slot];
  return (
    <div className={`hero-ability-card ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="hero-ability-summary"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="hero-ability-glyph" aria-hidden>
          {glyph}
        </span>
        <span className="hero-ability-name">{label}</span>
        <span className="hero-ability-toggle" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded && (
        <div className="hero-ability-detail">
          <p className="hero-ability-blurb">{ABILITY_BLURB[a.type]}</p>
          <ul className="hero-ability-stats">
            {formatAbilityStats(spec, slot).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const HeroDetail = ({
  variant,
  availableStars,
  activeHero,
  unlocked,
  onBack,
}: {
  variant: HeroVariant;
  availableStars: number;
  activeHero: HeroVariant;
  unlocked: boolean;
  onBack: () => void;
}) => {
  const spec = HERO_SPECS[variant];
  const progress = useGame((s) => s.progress);
  const unlockHero = useGame((s) => s.unlockHero);
  const setActiveHero = useGame((s) => s.setActiveHero);
  const resetSkills = useGame((s) => s.resetHeroSkills);
  const [openAbility, setOpenAbility] = useState<0 | 1 | 2 | null>(null);

  const xp = progress.heroXp[variant] ?? 0;
  const ranks = progress.heroSkills[variant];
  const level = levelForXp(xp);
  const { into, need, maxed } = xpProgressInLevel(xp);
  const pts = heroSkillPointsAvailable(xp, ranks);
  const active = activeHero === variant;
  const canUnlock = !unlocked && availableStars >= spec.unlockStars;
  const xpPct = maxed ? 1 : need > 0 ? into / need : 0;
  const investedTotal = pts.spent;

  return (
    <div className="hero-detail">
      <button
        type="button"
        className="hero-detail-back"
        onClick={onBack}
        aria-label="Back to roster"
      >
        ← Roster
      </button>
      <div className="hero-detail-grid">
        <div className="hero-detail-preview">
          <HeroDiorama variant={variant} />
        </div>
        <div className="hero-detail-info">
          <div className="hero-detail-head">
            <div className="hero-detail-tag-row">
              <span className="hero-detail-callsign">{spec.callsign}</span>
              <span
                className="dmg-tag inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: DAMAGE_TYPE_COLOR[spec.damageType],
                  borderColor: DAMAGE_TYPE_COLOR[spec.damageType],
                }}
              >
                {DAMAGE_TYPE_LABEL[spec.damageType]}
              </span>
              {active && <span className="hero-detail-active">Active</span>}
            </div>
            <p className="hero-detail-blurb">{spec.blurb}</p>
          </div>

          <div className="hero-detail-stats">
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

          <div className="hero-ability-list">
            {([0, 1, 2] as const).map((slot) => (
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
              <div className="hero-level-block">
                <div className="hero-level-head">
                  <span className="hero-level-lvl">
                    Lv {level}
                    <span className="hero-level-max">/ {HERO_MAX_LEVEL}</span>
                  </span>
                  <span className="hero-level-xp">{maxed ? "MAX" : `${into} / ${need} XP`}</span>
                </div>
                <div className="hero-level-bar">
                  <div
                    className={`hero-level-fill ${maxed ? "maxed" : ""}`}
                    style={{ width: `${xpPct * 100}%` }}
                  />
                </div>
                <div className="hero-level-foot">
                  <span>
                    {HERO_POINTS_PER_LEVEL} skill point per level · earned {pts.earned}
                  </span>
                  <span className="hero-level-points">
                    {pts.available} pt{pts.available === 1 ? "" : "s"} to spend
                  </span>
                </div>
              </div>

              <div className="hero-skill-tree">
                {HERO_SKILL_TREE.map((node) => (
                  <SkillRow
                    key={node.id}
                    variant={variant}
                    node={node as HeroSkillNode}
                    rank={(ranks?.[node.id as HeroSkillId] ?? 0) as number}
                    available={pts.available}
                  />
                ))}
                {investedTotal > 0 && (
                  <button
                    type="button"
                    className="hero-skill-refund"
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
                  onClick={() => setActiveHero(variant)}
                >
                  Set Active
                </button>
              )}
            </>
          ) : (
            <div className="border-t border-border-faint pt-3 flex items-center gap-3">
              <span className="text-[12px] text-fg-muted">Unlock cost</span>
              <span className="text-blue text-base font-bold tabular-nums">
                ★ {spec.unlockStars}
              </span>
              <button
                type="button"
                className={`ml-auto btn ${canUnlock ? "btn-blue" : "btn-ghost"} text-sm py-2 px-4`}
                disabled={!canUnlock}
                onClick={() => unlockHero(variant)}
                title={
                  canUnlock ? "Unlock" : `Need ${spec.unlockStars - availableStars} more stars`
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

export const HeroShop = () => {
  const open = useGame((s) => s.heroShopOpen);
  const setOpen = useGame((s) => s.setHeroShopOpen);
  const progress = useGame((s) => s.progress);
  const resetAll = useGame((s) => s.resetAllHeroSkills);
  const [selected, setSelected] = useState<HeroVariant | null>(null);
  if (!open) return null;
  const earned = totalStars(progress);
  const metaSpent = spentMetaStars(progress.metaSkills);
  const heroSpent = ROSTER.filter((v) => v !== "george" && progress.heroUnlocks[v]).reduce(
    (acc, v) => acc + HERO_SPECS[v].unlockStars,
    0,
  );
  const availableStars = Math.max(0, earned - metaSpent - heroSpent);
  const anyInvested = Object.values(progress.heroSkills).some(
    (r) => r && Object.keys(r).length > 0,
  );

  const handleClose = () => {
    setSelected(null);
    setOpen(false);
  };

  return (
    <MenuOverlay
      title={selected ? HERO_SPECS[selected].label : "Pilot Roster"}
      subtitle={
        selected
          ? HERO_SPECS[selected].callsign
          : `${availableStars} stars available · ${heroSpent} invested in pilots`
      }
      onClose={handleClose}
      cardClassName="!w-[min(1100px,calc(100vw-24px))] !max-w-none !min-w-0 !px-4 sm:!px-6 md:!px-8"
    >
      <div className="hero-shop-panel w-full">
        {selected ? (
          <HeroDetail
            variant={selected}
            availableStars={availableStars}
            activeHero={progress.activeHero}
            unlocked={!!progress.heroUnlocks[selected]}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-1 mb-3">
              <p className="text-[11px] text-fg-muted leading-snug flex-1 min-w-0">
                Recruit pilots with earned stars. Each kill drips XP into the active pilot — level
                up to spend skill points in their tech tree.
              </p>
              {anyInvested && (
                <button
                  type="button"
                  className="btn btn-ghost text-xs py-1.5 px-3 shrink-0 whitespace-nowrap"
                  onClick={resetAll}
                >
                  Refund all
                </button>
              )}
            </div>
            <div className="hero-roster-grid">
              {ROSTER.map((variant) => (
                <RosterCard
                  key={variant}
                  variant={variant}
                  activeHero={progress.activeHero}
                  unlocked={!!progress.heroUnlocks[variant]}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </MenuOverlay>
  );
};
