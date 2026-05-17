import type { BossVariant, EnemyKind } from "../sim/types";
import { useBakedIcon } from "./bakedIcon";
import { specFor } from "./EnemyIcon.specs";

type Props = {
  kind: EnemyKind;
  bossVariant?: BossVariant;
  className?: string;
  size?: number;
};

export const EnemyIcon = ({ kind, bossVariant, className, size }: Props) => {
  const url = useBakedIcon(specFor(kind, bossVariant));
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
