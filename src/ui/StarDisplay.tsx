import type { Stars } from "../progress";

export const STAR_STAGGER_MS = 220;

// Per-slot identity — 3 fixed star positions never reorder or grow/shrink.
// Labels beyond 3 are rare (max=5 is hypothetical); fall back to a
// position-suffix key for those.
const STAR_SLOT_KEYS = ["slot-left", "slot-middle", "slot-right"];

type Props = {
  count: number;
  max?: number;
  size?: number;
  animate?: boolean;
};

export const StarDisplay = ({ count, max = 3, size = 18, animate = false }: Props) => {
  return (
    <div className="stars-row" style={{ gap: Math.round(size * 0.25) }}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < count;
        const delay = animate ? `${i * STAR_STAGGER_MS}ms` : "0ms";
        const key = STAR_SLOT_KEYS[i] ?? `slot-${i}`;
        return (
          <Star key={key} size={size} filled={filled} animate={animate && filled} delay={delay} />
        );
      })}
    </div>
  );
};

const Star = ({
  size,
  filled,
  animate,
  delay,
}: {
  size: number;
  filled: boolean;
  animate: boolean;
  delay: string;
}) => {
  const color = filled ? "#ffd66a" : "#2a3240";
  const stroke = filled ? "#ffe8a8" : "#3a4452";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={filled ? "filled star" : "empty star"}
      style={animate ? { animation: `starPop 0.4s ease-out ${delay} backwards` } : undefined}
    >
      <title>{filled ? "filled star" : "empty star"}</title>
      <path
        d="M12 2.5 L14.9 8.9 L22 9.8 L16.7 14.6 L18.1 21.5 L12 17.9 L5.9 21.5 L7.3 14.6 L2 9.8 L9.1 8.9 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const starsToLabel = (count: Stars): string =>
  count === 0 ? "No stars" : `${count} star${count === 1 ? "" : "s"}`;
