import { totalStars } from "../progress";
import {
  HERO_SKILL_MAX_RANK,
  HERO_SKILL_TREE,
  type HeroSkillId,
  type HeroSkillNode,
  heroSkillPointsAvailable,
  levelForXp,
  xpProgressInLevel,
} from "../sim/heroSkills";
import { HERO_SPECS } from "../sim/heroVariants";
import { spentMetaStars } from "../sim/metaSkills";
import type { HeroVariant } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL } from "../sim/world";
import { useGame } from "../store";
import { HeroDiorama } from "./HeroDiorama";
import { HeroPreview } from "./HeroPreview";
import { MenuOverlay } from "./MenuOverlay";

const ROSTER: HeroVariant[] = ["george", "leela", "mike", "stan"];

const RankPips = ({
  rank,
  available,
  onClick,
}: {
  rank: number;
  available: number;
  onClick: (target: number) => void;
}) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: HERO_SKILL_MAX_RANK }).map((_, i) => {
      const tier = i + 1;
      const filled = tier <= rank;
      const target = filled && tier === rank ? rank - 1 : tier;
      const wouldSpend = Math.max(0, tier - rank);
      const affordable = wouldSpend <= available;
      const disabled = !filled && !affordable;
      const cls = filled
        ? "bg-blue border-blue"
        : affordable
          ? "bg-transparent border-blue/70 hover:bg-blue/30"
          : "bg-transparent border-fg-faint";
      return (
        <button
          key={`pip-${tier}`}
          type="button"
          className={`w-4 h-4 rounded-full border-2 transition-colors ${cls} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
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
  const currentDesc = rank > 0 ? node.rankDesc[rank - 1] : "Not invested";
  const nextDesc = rank < HERO_SKILL_MAX_RANK ? node.rankDesc[rank] : null;
  return (
    <div className="border-t border-border-faint py-2 first:border-t-0">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-fg leading-tight">{node.name}</div>
          <div className="text-[11px] text-fg-muted leading-snug mt-0.5">{node.blurb}</div>
        </div>
        <RankPips
          rank={rank}
          available={available}
          onClick={(target) => setRank(variant, node.id, target)}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px] tabular-nums">
        <span className={rank > 0 ? "text-mint" : "text-fg-dim"}>{currentDesc}</span>
        {nextDesc && (
          <>
            <span className="text-fg-faint">→</span>
            <span className="text-blue/80">{nextDesc}</span>
            <span className="text-fg-faint ml-auto">1 pt</span>
          </>
        )}
      </div>
    </div>
  );
};

const HeroCard = ({
  variant,
  availableStars,
  activeHero,
  unlocked,
}: {
  variant: HeroVariant;
  availableStars: number;
  activeHero: HeroVariant;
  unlocked: boolean;
}) => {
  const spec = HERO_SPECS[variant];
  const progress = useGame((s) => s.progress);
  const unlockHero = useGame((s) => s.unlockHero);
  const setActiveHero = useGame((s) => s.setActiveHero);
  const resetSkills = useGame((s) => s.resetHeroSkills);

  const xp = progress.heroXp[variant] ?? 0;
  const ranks = progress.heroSkills[variant];
  const level = levelForXp(xp);
  const { into, need } = xpProgressInLevel(xp);
  const pts = heroSkillPointsAvailable(xp, ranks);
  const active = activeHero === variant;
  const canUnlock = !unlocked && availableStars >= spec.unlockStars;
  const xpPct = need > 0 ? into / need : 0;
  const investedTotal = pts.spent;

  return (
    <div
      className={`bg-surface-1 border ${active ? "border-blue" : "border-border"} rounded-lg p-3 flex flex-col gap-2`}
      style={active ? { boxShadow: "0 0 18px rgba(159,216,255,0.18)" } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0">
          <HeroPreview variant={variant} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-fg leading-tight">{spec.label}</span>
            <span className="text-[11px] text-fg-muted uppercase tracking-wide">
              {spec.callsign}
            </span>
            {active && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-blue">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="dmg-tag inline-flex items-center gap-1 text-[10px]"
              style={{
                color: DAMAGE_TYPE_COLOR[spec.damageType],
                borderColor: DAMAGE_TYPE_COLOR[spec.damageType],
              }}
            >
              {DAMAGE_TYPE_LABEL[spec.damageType]}
            </span>
            <span className="text-[10px] text-fg-muted">Lv {level}</span>
          </div>
          <div className="text-[11px] text-fg-muted leading-snug mt-1">{spec.blurb}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[10px] tabular-nums text-fg-muted">
        <div>
          <span className="block text-fg-dim">HP</span>
          <span className="text-fg">{spec.maxHp}</span>
        </div>
        <div>
          <span className="block text-fg-dim">SPD</span>
          <span className="text-fg">{spec.speed}</span>
        </div>
        <div>
          <span className="block text-fg-dim">DMG</span>
          <span className="text-fg">{spec.damage}</span>
        </div>
        <div>
          <span className="block text-fg-dim">RNG</span>
          <span className="text-fg">{spec.range}</span>
        </div>
      </div>

      <div className="text-[10px] text-fg-muted flex flex-wrap gap-1.5">
        {spec.abilityLabels.map((lbl, i) => (
          <span key={lbl} className="px-1.5 py-0.5 rounded bg-surface-0 border border-border-faint">
            {spec.abilityGlyphs[i]} {lbl}
          </span>
        ))}
      </div>

      <div className="mt-1">
        <div className="hero-card-diorama">
          <HeroDiorama variant={variant} />
        </div>
      </div>

      {unlocked ? (
        <>
          <div className="hero-card-xp-row">
            <span className="text-[10px] text-fg-muted uppercase tracking-wide">Lv {level}</span>
            <div className="hero-card-xp-bar">
              <div className="hero-card-xp-fill" style={{ width: `${xpPct * 100}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-fg-muted">
              {into}/{need}
            </span>
          </div>

          <div className="border-t border-border-faint pt-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide mb-1">
              <span className="text-fg-muted">Tech Tree</span>
              <span className="text-blue tabular-nums">
                {pts.available} pt{pts.available === 1 ? "" : "s"}
              </span>
            </div>
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
                className="text-[10px] text-fg-muted hover:text-red px-2 py-1 rounded border border-border-faint hover:border-red mt-1"
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
              className="btn btn-blue text-sm py-1.5"
              onClick={() => setActiveHero(variant)}
            >
              Set Active
            </button>
          )}
        </>
      ) : (
        <div className="border-t border-border-faint pt-2 flex items-center gap-2">
          <span className="text-[11px] text-fg-muted">Unlock cost</span>
          <span className="text-blue text-sm font-bold tabular-nums">★ {spec.unlockStars}</span>
          <button
            type="button"
            className={`ml-auto btn ${canUnlock ? "btn-blue" : "btn-ghost"} text-sm py-1.5 px-3`}
            disabled={!canUnlock}
            onClick={() => unlockHero(variant)}
            title={canUnlock ? "Unlock" : `Need ${spec.unlockStars - availableStars} more stars`}
          >
            {canUnlock ? "Unlock" : "Locked"}
          </button>
        </div>
      )}
    </div>
  );
};

export const HeroShop = () => {
  const open = useGame((s) => s.heroShopOpen);
  const setOpen = useGame((s) => s.setHeroShopOpen);
  const progress = useGame((s) => s.progress);
  const resetAll = useGame((s) => s.resetAllHeroSkills);
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

  return (
    <MenuOverlay
      title="Pilot Roster"
      subtitle={`${availableStars} stars available · ${heroSpent} invested in pilots`}
      onClose={() => setOpen(false)}
      cardClassName="!w-[min(1200px,calc(100vw-48px))] !max-w-none"
    >
      <div className="hero-shop-panel w-full">
        <div className="flex items-center justify-between gap-3 px-1 mb-3">
          <p className="text-[11px] text-fg-muted leading-snug flex-1 min-w-0">
            Recruit pilots with earned stars. Each kill drips XP into the active pilot — level up to
            spend skill points in their tech tree. Swap pilots between runs or mid-game from here.
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
        <div className="hero-shop-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
          {ROSTER.map((variant) => (
            <HeroCard
              key={variant}
              variant={variant}
              availableStars={availableStars}
              activeHero={progress.activeHero}
              unlocked={!!progress.heroUnlocks[variant]}
            />
          ))}
        </div>
      </div>
    </MenuOverlay>
  );
};
