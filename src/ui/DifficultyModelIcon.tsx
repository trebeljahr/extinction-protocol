import type { Difficulty } from "../progress";
import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";
import { type BakeSpec, useBakedIcon } from "./bakedIcon";

// One representative dinosaur per tier: peaceful long-neck for easy,
// pack-hunter raptor for medium, apex predator T-Rex for hard, and the
// matriarch apatosaurus for extinction (same mesh used as the boss in
// world.ts so the silhouette is unmistakable).
const DIFFICULTY_KIND: Record<Difficulty, EnemyKind> = {
  easy: "para",
  medium: "raptor",
  hard: "allosaur",
  extinction: "boss",
};

// Saturated form of DIFFICULTY_ACCENT, used as the source color for the
// mix-blend overlay. The card container already paints a faint tint
// behind the icon; this is the per-pixel hue shift on the model itself.
const TINT: Record<Difficulty, string> = {
  easy: "#b4ffc9",
  medium: "#9fd8ff",
  hard: "#ffb266",
  extinction: "#ff5a7a",
};

// Side-view framing, same coordinate space as EnemyIcon (the baker
// normalizes every model to a 1×1×1 box, bottom at y=0). With FOV 30°
// the visible window at the target plane is 0.536 × camDist, so a
// length-normalized dino (max-dim = 1) needs camDist ≥ ~2.3 just to
// fit edge-to-edge; below that, tail and head clip the frame. All four
// share camDist = 2.4 (~13% margin per side); per-dino targetY shifts
// the body vertically so head/feet don't kiss the top/bottom edges.
const CAM_TUNING: Record<Difficulty, { camDist: number; camY: number; targetY: number }> = {
  // Parasaur — bipedal grazer, crest pushes head high in frame.
  easy: { camDist: 2.4, camY: 0.32, targetY: 0.22 },
  // Velociraptor — compact biped, body roughly centered.
  medium: { camDist: 2.4, camY: 0.3, targetY: 0.2 },
  // T-Rex — tallest silhouette, head sits high; target nudges up.
  hard: { camDist: 2.4, camY: 0.34, targetY: 0.25 },
  // Apatosaurus — long quadruped, low body; target sits near the spine.
  extinction: { camDist: 2.4, camY: 0.22, targetY: 0.15 },
};

const specFor = (d: Difficulty): BakeSpec => {
  const kind = DIFFICULTY_KIND[d];
  const t = CAM_TUNING[d];
  // Encode framing into the cache key so dev-time tuning of CAM_TUNING
  // re-bakes instead of serving the stale cached PNG.
  const framingTag = `${t.camDist}-${t.camY}-${t.targetY}`;
  return {
    cacheKey: `difficulty:${d}:${framingTag}`,
    modelUrl: ENEMY_MODEL[kind].url,
    skinned: true,
    rotY: 0,
    camera: {
      position: [t.camDist, t.camY, 0.0001],
      target: [0, t.targetY, 0],
      fov: 30,
    },
  };
};

type Props = {
  difficulty: Difficulty;
  className?: string;
};

export const DifficultyModelIcon = ({ difficulty, className }: Props) => {
  const url = useBakedIcon(specFor(difficulty));
  const tint = TINT[difficulty];

  if (!url) {
    return <div className={`difficulty-model-pending ${className ?? ""}`} aria-hidden />;
  }

  // `isolation: isolate` keeps the mix-blend-mode inside this container
  // so the overlay only tints the dino image, never the page behind it.
  // The overlay reuses the baked PNG as a mask so the saturated fill is
  // clipped to the dinosaur silhouette — outside the silhouette stays
  // fully transparent and the parent's accent.tint shows through.
  const maskStyle = {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as const;

  return (
    <div className={`relative isolate ${className ?? ""}`} aria-hidden>
      <img
        src={url}
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "contain", display: "block" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: tint,
          mixBlendMode: "color",
          opacity: 0.7,
          ...maskStyle,
        }}
      />
    </div>
  );
};
