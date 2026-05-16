import { useGame } from "../store";
import { HeroPreview } from "./HeroPreview";

// Top-left "banner" — clicking it opens the hero menu (HeroShop) so the
// menu has exactly one trigger and selection is a separate action via
// the canvas-side hero mesh. The banner still shows live HP/level so the
// player can scan hero status without opening the shop.
export const HeroMiniIcon = () => {
  const variant = useGame((s) => s.ui.heroVariant);
  const hp = useGame((s) => s.ui.heroHp);
  const maxHp = useGame((s) => s.ui.heroMaxHp);
  const alive = useGame((s) => s.ui.heroAlive);
  const respawnRemaining = useGame((s) => s.ui.heroRespawnRemaining);
  const level = useGame((s) => s.ui.heroLevel);
  const status = useGame((s) => s.ui.status);
  const setHeroShopOpen = useGame((s) => s.setHeroShopOpen);

  if (status !== "running" && status !== "paused") return null;

  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  return (
    <button
      type="button"
      className={`hero-mini ${alive ? "" : "dead"}`}
      onClick={() => setHeroShopOpen(true)}
      title={alive ? `Hero menu · ${hp}/${maxHp} HP` : `Respawn in ${respawnRemaining}s`}
      aria-label="Open hero menu"
    >
      <HeroPreview variant={variant} />
      <div className="hero-mini-body">
        <div className="hero-mini-row">
          <span className="hero-mini-label">HERO</span>
          <span className="hero-mini-lvl">Lv {level}</span>
        </div>
        <div className="hero-mini-bar">
          <div className="hero-mini-bar-fill" style={{ width: `${hpPct * 100}%` }} />
        </div>
        <div className="hero-mini-hp">
          {alive ? `${hp}/${maxHp}` : respawnRemaining > 0 ? `respawn ${respawnRemaining}s` : "—"}
        </div>
      </div>
    </button>
  );
};
