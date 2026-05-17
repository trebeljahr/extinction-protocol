import type { BossVariant, EnemyKind } from "../sim/types";
import {
  BOSS_VARIANT_MATERIAL,
  BOSS_VARIANT_MODEL,
  BOSS_VARIANT_TINT,
  ENEMY_MODEL,
} from "../sim/world";
import { type BakeSpec, prewarmIcon } from "./bakedIcon";

// Per-kind side-view framing. The shared baker normalizes every model
// to a 1×1×1 box, so these numbers all live in the same coordinate
// space. Two constraints:
//   1. camDist must keep the visible frame (2 * camDist * tan(fov/2))
//      wider than 1.0, or the longest axis clips — most visibly on the
//      T-Rex tail and the apatosaur body. At fov=30 that means camDist
//      ≳ 1.9; we run 2.0–2.4 for breathing room.
//   2. targetY should sit at the visible body's vertical midpoint so
//      the model lands in the icon's center. For most dinosaurs that's
//      ~0.24 in normalized space. Two outliers: the apatosaur (titan/
//      boss) is so flat once length is normalized that its body midline
//      sits near Y=0.11; the triceratops's bind-pose bbox includes bone
//      tips below the visible mesh, so post-grounding the body floats
//      up and its midline lands near Y=0.46.
const ICON_TUNING: Record<
  EnemyKind,
  { rotY: number; camDist: number; camY: number; targetY: number }
> = {
  raptor: { rotY: 0, camDist: 2.05, camY: 0.3, targetY: 0.24 },
  // Swarm uses an instance grid (see SWARM_FLOCK) to render 6 raptors as
  // a pack; the camera pulls back so they all fit and sits a touch lower
  // so the floor-level group lands in the icon's vertical centre.
  swarm: { rotY: 0, camDist: 2.75, camY: 0.22, targetY: 0.16 },
  para: { rotY: 0, camDist: 2.1, camY: 0.3, targetY: 0.24 },
  allosaur: { rotY: 0, camDist: 2.15, camY: 0.29, targetY: 0.23 },
  stego: { rotY: 0, camDist: 2.1, camY: 0.29, targetY: 0.23 },
  armored: { rotY: 0, camDist: 2.05, camY: 0.52, targetY: 0.46 },
  titan: { rotY: 0, camDist: 2.3, camY: 0.18, targetY: 0.11 },
  boss: { rotY: 0, camDist: 2.3, camY: 0.18, targetY: 0.11 },
};

// Hand-tuned flock arrangement for the swarm icon. Camera sits on +X
// looking at the origin, so +Z is rightward in the icon and +X is toward
// the camera (smaller X = further back). Slight rotY variations break up
// the copy-paste look without making any raptor face away.
const SWARM_FLOCK: NonNullable<BakeSpec["instances"]> = [
  { scale: 0.55, offset: [0.15, 0, -0.05], rotY: -0.05 },
  { scale: 0.5, offset: [0.05, 0, 0.45], rotY: -0.18 },
  { scale: 0.48, offset: [0.0, 0, -0.5], rotY: 0.15 },
  { scale: 0.45, offset: [-0.2, 0, 0.2], rotY: 0.05 },
  { scale: 0.44, offset: [-0.25, 0, -0.25], rotY: -0.1 },
  { scale: 0.4, offset: [-0.45, 0, 0.0], rotY: 0.22 },
];

// Per-variant species → tuning key. Matriarch variants reuse their
// base species's icon framing (same model, different scale/tint) so
// we don't need a duplicate tuning table.
const BOSS_VARIANT_BASE_KIND: Record<BossVariant, EnemyKind> = {
  raptor: "raptor",
  stego: "stego",
  para: "para",
  allosaur: "allosaur",
  armored: "armored",
  apex: "boss",
};

export const specFor = (kind: EnemyKind, bossVariant?: BossVariant): BakeSpec => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  const tuningKey = isMatriarch ? BOSS_VARIANT_BASE_KIND[bossVariant] : kind;
  const t = ICON_TUNING[tuningKey];
  const instances = kind === "swarm" ? SWARM_FLOCK : undefined;
  const material = isMatriarch ? BOSS_VARIANT_MATERIAL[bossVariant] : null;
  // Framing baked into the cache key so dev-time tuning re-bakes
  // instead of serving the stale PNG. Instance signature is folded in
  // so swarm-layout edits invalidate the cache too. Variant tint is
  // folded in so each matriarch gets her own cache entry.
  const framingTag = `${t.camDist}-${t.camY}-${t.targetY}`;
  const instTag = instances ? `i${instances.length}-${instances[0].scale}` : "i1";
  const materialTag =
    isMatriarch && material
      ? `${BOSS_VARIANT_TINT[bossVariant]}-${material.tintAmount}-${material.emissiveAmount}`
      : "base";
  const cacheKey = isMatriarch
    ? `matriarch:${bossVariant}:${framingTag}:${instTag}:${materialTag}`
    : `enemy:${kind}:${framingTag}:${instTag}`;
  const modelUrl = isMatriarch ? BOSS_VARIANT_MODEL[bossVariant].url : ENEMY_MODEL[kind].url;
  return {
    cacheKey,
    modelUrl,
    skinned: true,
    rotY: t.rotY,
    instances,
    // 0.0001 z-offset keeps the camera matrix non-degenerate when looking straight down the X axis.
    camera: {
      position: [t.camDist, t.camY, 0.0001],
      target: [0, t.targetY, 0],
      fov: 30,
    },
    ...(isMatriarch
      ? {
          tint: {
            color: BOSS_VARIANT_TINT[bossVariant],
            amount: material?.tintAmount ?? 0,
            emissive: material?.emissiveAmount ?? 0,
          },
        }
      : {}),
  };
};

const ALL_ENEMY_KINDS: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
  "boss",
];

const ALL_BOSS_VARIANTS: BossVariant[] = ["raptor", "stego", "para", "allosaur", "armored", "apex"];

// Kick off the bake for every base species + matriarch variant. The bake
// queue is sequential, so call this early (HUD mount) to spread the cost
// across idle time — otherwise the first compendium / new-enemy popup on
// a slow phone shows an empty placeholder while six GLBs serialize.
export const prewarmEnemyIcons = (): void => {
  for (const kind of ALL_ENEMY_KINDS) prewarmIcon(specFor(kind));
  for (const variant of ALL_BOSS_VARIANTS) prewarmIcon(specFor("boss", variant));
};
