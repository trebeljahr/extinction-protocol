import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";
import { type BakeSpec, useBakedIcon } from "./bakedIcon";

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
  swarm: { rotY: 0, camDist: 2.05, camY: 0.3, targetY: 0.24 },
  para: { rotY: 0, camDist: 2.1, camY: 0.3, targetY: 0.24 },
  allosaur: { rotY: 0, camDist: 2.15, camY: 0.29, targetY: 0.23 },
  stego: { rotY: 0, camDist: 2.1, camY: 0.29, targetY: 0.23 },
  armored: { rotY: 0, camDist: 2.05, camY: 0.52, targetY: 0.46 },
  titan: { rotY: 0, camDist: 2.3, camY: 0.18, targetY: 0.11 },
  boss: { rotY: 0, camDist: 2.3, camY: 0.18, targetY: 0.11 },
};

const specFor = (kind: EnemyKind): BakeSpec => {
  const t = ICON_TUNING[kind];
  // Framing baked into the cache key so dev-time tuning re-bakes
  // instead of serving the stale PNG. Same trick as DifficultyModelIcon.
  const framingTag = `${t.camDist}-${t.camY}-${t.targetY}`;
  return {
    cacheKey: `enemy:${kind}:${framingTag}`,
    modelUrl: ENEMY_MODEL[kind].url,
    skinned: true,
    rotY: t.rotY,
    // 0.0001 z-offset keeps the camera matrix non-degenerate when looking straight down the X axis.
    camera: {
      position: [t.camDist, t.camY, 0.0001],
      target: [0, t.targetY, 0],
      fov: 30,
    },
  };
};

type Props = {
  kind: EnemyKind;
  className?: string;
  size?: number;
};

export const EnemyIcon = ({ kind, className, size }: Props) => {
  const url = useBakedIcon(specFor(kind));
  const style: React.CSSProperties =
    size !== undefined ? { width: size, height: size } : { width: "100%", height: "100%" };
  if (!url) {
    return <div className={`enemy-icon enemy-icon-pending ${className ?? ""}`} style={style} />;
  }
  return (
    <img
      className={`enemy-icon ${className ?? ""}`}
      style={{ ...style, objectFit: "contain", display: "block" }}
      src={url}
      alt=""
      aria-hidden
    />
  );
};
