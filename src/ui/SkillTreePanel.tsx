import { totalStars } from "../progress";
import {
  effectiveTowerCost,
  getRank,
  MAX_RANK,
  META_SKILL_TREE,
  type MetaSkillNode,
  spentMetaStars,
} from "../sim/metaSkills";
import type { TowerKind } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL, TOWER_DAMAGE_TYPE, TOWER_LABEL } from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { MenuOverlay } from "./MenuOverlay";
import { TowerPreview } from "./TowerPreview";

const KIND_ORDER: TowerKind[] = ["pulse", "chain", "flame", "hive", "mortar", "cryo"];

// Inline pip strip — visually matches the rank ladder. Filled = invested,
// outlined = next-up (affordable), faded = locked behind earlier ranks.
const RankPips = ({
  rank,
  available,
  onClick,
}: {
  rank: number;
  available: number;
  onClick: (target: number) => void;
}) => {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: MAX_RANK }).map((_, i) => {
        const tier = i + 1;
        const filled = tier <= rank;
        // Clicking a filled pip refunds back to that tier (so the click
        // target acts as a slider: click rank 2 to be at rank 2). Clicking
        // an unfilled pip raises rank to that tier — gated by the player's
        // free-star budget.
        const target = filled && tier === rank ? rank - 1 : tier;
        const wouldSpend = Math.max(0, tier - rank);
        const affordable = wouldSpend <= available;
        const disabled = !filled && !affordable;
        const cls = filled
          ? "bg-gold border-gold"
          : affordable
            ? "bg-transparent border-gold/70 hover:bg-gold/30"
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
};

const SkillRow = ({
  kind,
  node,
  available,
}: {
  kind: TowerKind;
  node: MetaSkillNode;
  available: number;
}) => {
  const rank = useGame((s) => getRank(s.progress.metaSkills, kind, node.id));
  const setRank = useGame((s) => s.setMetaSkillRank);
  const currentDesc = rank > 0 ? node.rankDesc[rank - 1] : "Not invested";
  const nextDesc = rank < MAX_RANK ? node.rankDesc[rank] : null;
  return (
    <div className="border-t border-border-faint py-2.5 first:border-t-0">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-fg leading-tight">{node.name}</div>
          <div className="text-[11px] text-fg-muted leading-snug mt-0.5">{node.blurb}</div>
        </div>
        <RankPips
          rank={rank}
          available={available}
          onClick={(target) => setRank(kind, node.id, target)}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px] tabular-nums">
        <span className={rank > 0 ? "text-mint" : "text-fg-dim"}>{currentDesc}</span>
        {nextDesc && (
          <>
            <span className="text-fg-faint">→</span>
            <span className="text-gold/80">{nextDesc}</span>
            <span className="text-fg-faint ml-auto">1★</span>
          </>
        )}
      </div>
    </div>
  );
};

const TowerCard = ({ kind, available }: { kind: TowerKind; available: number }) => {
  const tree = META_SKILL_TREE[kind];
  const metaSkills = useGame((s) => s.progress.metaSkills);
  const cost = effectiveTowerCost(kind, metaSkills);
  const dmgType = TOWER_DAMAGE_TYPE[kind];
  const resetKind = useGame((s) => s.resetMetaSkillsForKind);
  const investedCount = (() => {
    const ranks = metaSkills[kind] ?? {};
    let n = 0;
    for (const id in ranks) n += ranks[id] ?? 0;
    return n;
  })();
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-3 flex flex-col">
      <div className="flex items-center gap-3 pb-2.5 border-b border-border-faint">
        <div className="w-14 h-14 shrink-0">
          <TowerPreview kind={kind} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-fg leading-tight">{TOWER_LABEL[kind]}</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="dmg-tag inline-flex items-center gap-1 text-[10px]"
              style={{ color: DAMAGE_TYPE_COLOR[dmgType], borderColor: DAMAGE_TYPE_COLOR[dmgType] }}
            >
              <DamageIcon type={dmgType} size={10} title={DAMAGE_TYPE_LABEL[dmgType]} />
              {DAMAGE_TYPE_LABEL[dmgType]}
            </span>
            <span className="text-[11px] text-gold tabular-nums">{cost}g</span>
          </div>
        </div>
        {investedCount > 0 && (
          <button
            type="button"
            className="text-[10px] text-fg-muted hover:text-red transition-colors px-2 py-1 rounded border border-border-faint hover:border-red"
            onClick={() => resetKind(kind)}
            title={`Refund all ${investedCount} star${investedCount === 1 ? "" : "s"}`}
          >
            ↺ {investedCount}★
          </button>
        )}
      </div>
      <div className="flex-1">
        {tree.map((node) => (
          <SkillRow key={node.id} kind={kind} node={node} available={available} />
        ))}
      </div>
    </div>
  );
};

export const SkillTreePanel = () => {
  const progress = useGame((s) => s.progress);
  const setOpen = useGame((s) => s.setSkillTreeOpen);
  const resetAll = useGame((s) => s.resetAllMetaSkills);
  const earned = totalStars(progress);
  const spent = spentMetaStars(progress.metaSkills);
  const available = Math.max(0, earned - spent);

  return (
    <MenuOverlay
      title="Operations · Tower R&D"
      subtitle={`${available} stars available · ${spent} invested · ${earned} earned`}
      onClose={() => setOpen(false)}
      cardClassName="!w-[min(1180px,calc(100vw-48px))] !max-w-none"
    >
      <div className="skill-tree-panel w-full">
        <div className="flex items-center justify-between gap-3 px-1 mb-3">
          <p className="text-[11px] text-fg-muted leading-snug flex-1 min-w-0">
            Permanent upgrades baked into every tower you build. Spend stars from cleared waves;
            refund any node for free to re-spec between runs.
          </p>
          {spent > 0 && (
            <button
              type="button"
              className="btn btn-ghost text-xs py-1.5 px-3 shrink-0 whitespace-nowrap"
              onClick={resetAll}
              title="Refund every node across every tower"
            >
              Refund all
            </button>
          )}
        </div>
        <div className="skill-tree-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {KIND_ORDER.map((kind) => (
            <TowerCard key={kind} kind={kind} available={available} />
          ))}
        </div>
      </div>
    </MenuOverlay>
  );
};
