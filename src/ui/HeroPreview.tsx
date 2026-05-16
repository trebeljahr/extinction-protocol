import { HERO_SPECS } from "../sim/heroVariants";
import type { HeroVariant } from "../sim/types";
import { type BakeSpec, prewarmIcon, useBakedIcon } from "./bakedIcon";

const HERO_URL: Record<HeroVariant, string> = {
  george: "/models/heroes/George.glb",
  leela: "/models/heroes/Leela.glb",
  mike: "/models/heroes/Mike.glb",
  stan: "/models/heroes/Stan.glb",
};

const VARIANTS: HeroVariant[] = ["george", "leela", "mike", "stan"];

const specFor = (variant: HeroVariant): BakeSpec => ({
  cacheKey: `hero:${variant}`,
  modelUrl: HERO_URL[variant],
  // Mech GLBs are skinned (have animation rig) so SkeletonUtils.clone is
  // what bakedIcon should use.
  skinned: true,
  rotY: -0.35,
  camera: { position: [2.3, 1.7, 1.9], target: [0, 0.5, 0], fov: 38 },
});

export const prewarmHeroIcons = (): void => {
  for (const v of VARIANTS) prewarmIcon(specFor(v));
};

export const HeroPreview = ({ variant }: { variant: HeroVariant }) => {
  const url = useBakedIcon(specFor(variant));
  const tint = HERO_SPECS[variant].tint;
  return (
    <div className="hero-swatch" style={{ borderColor: `${tint}55` }}>
      {url ? (
        <img
          className="hero-icon"
          src={url}
          alt=""
          aria-hidden
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      ) : (
        <div className="hero-icon hero-icon-pending" />
      )}
    </div>
  );
};
