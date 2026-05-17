import { DAMAGE_TYPE_COLOR, SUPPORT_PILL_COLOR, type TowerPillType } from "../sim/world";

type Props = {
  type: TowerPillType;
  size?: number;
  title?: string;
  color?: string;
};

export const DamageIcon = ({ type, size = 16, title, color }: Props) => {
  const fill = color ?? (type === "support" ? SUPPORT_PILL_COLOR : DAMAGE_TYPE_COLOR[type]);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? type}>
      {title && <title>{title}</title>}
      {type === "kinetic" && <KineticPath fill={fill} />}
      {type === "electric" && <ElectricPath fill={fill} />}
      {type === "cold" && <ColdPath fill={fill} />}
      {type === "explosive" && <ExplosivePath fill={fill} />}
      {type === "flame" && <FlamePath fill={fill} />}
      {type === "support" && <SupportPath fill={fill} />}
    </svg>
  );
};

const SupportPath = ({ fill }: { fill: string }) => (
  <g>
    <circle cx="12" cy="12" r="9" fill={fill} opacity={0.18} />
    <path
      d="M10.4 4.5 H13.6 V10.4 H19.5 V13.6 H13.6 V19.5 H10.4 V13.6 H4.5 V10.4 H10.4 Z"
      fill={fill}
      stroke={fill}
      strokeWidth="0.4"
      strokeLinejoin="round"
    />
  </g>
);

const FlamePath = ({ fill }: { fill: string }) => (
  <g>
    <path
      d="M12 2.5 C 9 7, 5 9, 6 14 C 6.4 18, 9 21.5, 12 21.5 C 15 21.5, 17.6 18, 18 14 C 19 9, 15 7, 12 2.5 Z"
      fill={fill}
      stroke={fill}
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <path
      d="M12 8 C 10.5 11, 9 12.5, 9.6 15.5 C 10 18, 11 19.5, 12 19.5 C 13 19.5, 14 18, 14.4 15.5 C 15 12.5, 13.5 11, 12 8 Z"
      fill="#fff"
      opacity={0.55}
    />
  </g>
);

const KineticPath = ({ fill }: { fill: string }) => (
  <g>
    {/* Bullet: pointed tip + casing */}
    <path
      d="M12 2.5 L15.5 7.5 L15.5 17 L8.5 17 L8.5 7.5 Z"
      fill={fill}
      stroke={fill}
      strokeWidth="0.4"
      strokeLinejoin="round"
    />
    <rect x="8.5" y="16.5" width="7" height="4" rx="0.6" fill={fill} opacity={0.65} />
    <line x1="10" y1="10" x2="14" y2="10" stroke="#000" strokeOpacity={0.3} strokeWidth="0.6" />
  </g>
);

const ElectricPath = ({ fill }: { fill: string }) => (
  <path
    d="M13.5 2.5 L5 13 L11 13 L9.5 21.5 L19 10 L13 10 Z"
    fill={fill}
    stroke={fill}
    strokeWidth="0.6"
    strokeLinejoin="round"
  />
);

const ColdPath = ({ fill }: { fill: string }) => (
  <g stroke={fill} strokeWidth="1.6" strokeLinecap="round" fill="none">
    {/* Snowflake: 3 crossing lines with side barbs */}
    <line x1="12" y1="2.5" x2="12" y2="21.5" />
    <line x1="4" y1="7" x2="20" y2="17" />
    <line x1="4" y1="17" x2="20" y2="7" />
    {/* Barbs at each axis end */}
    <line x1="12" y1="4.5" x2="9.8" y2="6.5" />
    <line x1="12" y1="4.5" x2="14.2" y2="6.5" />
    <line x1="12" y1="19.5" x2="9.8" y2="17.5" />
    <line x1="12" y1="19.5" x2="14.2" y2="17.5" />
    <line x1="5.6" y1="8" x2="6.5" y2="10.8" />
    <line x1="5.6" y1="8" x2="8.3" y2="8.4" />
    <line x1="18.4" y1="16" x2="17.5" y2="13.2" />
    <line x1="18.4" y1="16" x2="15.7" y2="15.6" />
    <line x1="5.6" y1="16" x2="8.3" y2="15.6" />
    <line x1="5.6" y1="16" x2="6.5" y2="13.2" />
    <line x1="18.4" y1="8" x2="15.7" y2="8.4" />
    <line x1="18.4" y1="8" x2="17.5" y2="10.8" />
  </g>
);

const ExplosivePath = ({ fill }: { fill: string }) => {
  // 8-point burst / starburst
  const n = 8;
  const outer = 10;
  const inner = 4.4;
  const cx = 12;
  const cy = 12;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return (
    <g>
      <polygon
        points={pts.join(" ")}
        fill={fill}
        stroke={fill}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={2.4} fill="#fff" opacity={0.7} />
    </g>
  );
};
