import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";
import { type BakeSpec, useBakedIcon } from "./bakedIcon";

// Per-kind side-view framing. The shared baker normalizes every model
// to a 1×1×1 box, so these numbers all live in the same coordinate space.
const ICON_TUNING: Record<
  EnemyKind,
  { rotY: number; camDist: number; camY: number; targetY: number }
> = {
  raptor: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  swarm: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  para: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  allosaur: { rotY: 0, camDist: 1.5, camY: 0.5, targetY: 0.45 },
  stego: { rotY: 0, camDist: 1.5, camY: 0.45, targetY: 0.4 },
  armored: { rotY: 0, camDist: 1.5, camY: 0.45, targetY: 0.4 },
  titan: { rotY: 0, camDist: 1.5, camY: 0.55, targetY: 0.5 },
  boss: { rotY: 0, camDist: 1.5, camY: 0.55, targetY: 0.5 },
};

const specFor = (kind: EnemyKind): BakeSpec => {
  const t = ICON_TUNING[kind];
  return {
    cacheKey: `enemy:${kind}`,
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
