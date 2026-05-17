import type { MechanicId } from "../sim/mechanicsText";
import { MECHANIC_TINT } from "../sim/mechanicsText";

type Props = {
  id: MechanicId;
  size?: number;
};

export const MechanicIcon = ({ id, size = 220 }: Props) => {
  const fill = MECHANIC_TINT[id];
  return (
    <div className="mechanic-icon" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label={id}>
        <defs>
          <radialGradient id={`mech-${id}-bg`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={fill} stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0c1420" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill="#0c1420" />
        <circle cx="100" cy="100" r="92" fill={`url(#mech-${id}-bg)`} />
        {id === "shielded" && <ShieldGlyph fill={fill} />}
        {id === "healAura" && <HealAuraGlyph fill={fill} />}
        {id === "regen" && <RegenGlyph fill={fill} />}
        {id === "elite" && <EliteGlyph fill={fill} />}
        {id === "fierce" && <FierceGlyph fill={fill} />}
        {id === "slow" && <SlowGlyph fill={fill} />}
        {id === "adaptation" && <AdaptationGlyph fill={fill} />}
      </svg>
    </div>
  );
};

const ShieldGlyph = ({ fill }: { fill: string }) => (
  <g>
    <ellipse
      cx="100"
      cy="110"
      rx="68"
      ry="70"
      fill={fill}
      fillOpacity="0.12"
      stroke={fill}
      strokeWidth="2.5"
    />
    <ellipse
      cx="100"
      cy="110"
      rx="50"
      ry="52"
      fill={fill}
      fillOpacity="0.08"
      stroke={fill}
      strokeOpacity="0.5"
      strokeWidth="1.5"
    />
    <path
      d="M100 70 L130 88 V120 Q130 145 100 158 Q70 145 70 120 V88 Z"
      fill={fill}
      fillOpacity="0.18"
      stroke={fill}
      strokeWidth="2"
    />
  </g>
);

const HealAuraGlyph = ({ fill }: { fill: string }) => (
  <g>
    <circle
      cx="100"
      cy="115"
      r="78"
      fill="none"
      stroke={fill}
      strokeOpacity="0.35"
      strokeWidth="2"
    />
    <circle
      cx="100"
      cy="115"
      r="58"
      fill="none"
      stroke={fill}
      strokeOpacity="0.55"
      strokeWidth="2"
    />
    <circle
      cx="100"
      cy="115"
      r="38"
      fill={fill}
      fillOpacity="0.12"
      stroke={fill}
      strokeWidth="2.5"
    />
    <path d="M100 95 V135 M80 115 H120" stroke={fill} strokeWidth="6" strokeLinecap="round" />
  </g>
);

const RegenGlyph = ({ fill }: { fill: string }) => (
  <g>
    <circle cx="100" cy="100" r="56" fill={fill} fillOpacity="0.12" stroke={fill} strokeWidth="2" />
    <path d="M100 70 V130 M70 100 H130" stroke={fill} strokeWidth="10" strokeLinecap="round" />
    <path
      d="M148 92 a48 48 0 0 1 -96 16"
      fill="none"
      stroke={fill}
      strokeOpacity="0.5"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </g>
);

const EliteGlyph = ({ fill }: { fill: string }) => (
  <g>
    <polygon
      points="100,40 120,90 174,98 132,134 144,188 100,160 56,188 68,134 26,98 80,90"
      fill={fill}
      fillOpacity="0.18"
      stroke={fill}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <circle cx="100" cy="115" r="14" fill={fill} fillOpacity="0.5" />
  </g>
);

const FierceGlyph = ({ fill }: { fill: string }) => (
  <g>
    <circle
      cx="100"
      cy="100"
      r="60"
      fill="none"
      stroke={fill}
      strokeOpacity="0.35"
      strokeWidth="3"
    />
    <circle cx="100" cy="100" r="44" fill={fill} fillOpacity="0.18" stroke={fill} strokeWidth="2" />
    {[0, 60, 120, 180, 240, 300].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x1 = 100 + Math.cos(a) * 68;
      const y1 = 100 + Math.sin(a) * 68;
      const x2 = 100 + Math.cos(a) * 92;
      const y2 = 100 + Math.sin(a) * 92;
      return (
        <line
          key={deg}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={fill}
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    })}
  </g>
);

const SlowGlyph = ({ fill }: { fill: string }) => (
  <g stroke={fill} strokeLinecap="round" fill="none">
    <circle cx="100" cy="100" r="60" strokeWidth="2.5" strokeOpacity="0.35" />
    <line x1="100" y1="55" x2="100" y2="145" strokeWidth="3" />
    <line x1="55" y1="100" x2="145" y2="100" strokeWidth="3" />
    <line x1="68" y1="68" x2="132" y2="132" strokeWidth="3" />
    <line x1="68" y1="132" x2="132" y2="68" strokeWidth="3" />
    <line x1="100" y1="60" x2="92" y2="68" strokeWidth="2" />
    <line x1="100" y1="60" x2="108" y2="68" strokeWidth="2" />
    <line x1="100" y1="140" x2="92" y2="132" strokeWidth="2" />
    <line x1="100" y1="140" x2="108" y2="132" strokeWidth="2" />
    <line x1="60" y1="100" x2="68" y2="92" strokeWidth="2" />
    <line x1="60" y1="100" x2="68" y2="108" strokeWidth="2" />
    <line x1="140" y1="100" x2="132" y2="92" strokeWidth="2" />
    <line x1="140" y1="100" x2="132" y2="108" strokeWidth="2" />
  </g>
);

// Adaptation glyph: a DNA helix rendered as two interlocking sine-wave
// strands with five color stops — one per damage type — to evoke
// "evolving across the elemental spectrum" without leaning on game-art.
const ADAPT_STRAND_COLORS = ["#5a6478", "#a040ff", "#3ec0ff", "#ff8a1f", "#ff2a14"];
const AdaptationGlyph = ({ fill }: { fill: string }) => {
  const cy = 100;
  const amp = 28;
  const x0 = 38;
  const x1 = 162;
  const points = 32;
  const ladder: number[] = [];
  for (let i = 1; i < points; i += 4) ladder.push(i / (points - 1));
  return (
    <g>
      <circle
        cx="100"
        cy="100"
        r="80"
        fill={fill}
        fillOpacity="0.06"
        stroke={fill}
        strokeOpacity="0.4"
        strokeWidth="2"
      />
      {[0, 1].map((strand) => {
        const phase = strand === 0 ? 0 : Math.PI;
        let d = "";
        for (let i = 0; i <= points; i++) {
          const t = i / points;
          const x = x0 + (x1 - x0) * t;
          const y = cy + Math.sin(t * Math.PI * 2 + phase) * amp;
          d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
        }
        return (
          <path
            key={strand}
            d={d}
            fill="none"
            stroke={fill}
            strokeOpacity="0.85"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
      {ladder.map((t, idx) => {
        const x = x0 + (x1 - x0) * t;
        const y1 = cy + Math.sin(t * Math.PI * 2) * amp;
        const y2 = cy + Math.sin(t * Math.PI * 2 + Math.PI) * amp;
        const c = ADAPT_STRAND_COLORS[idx % ADAPT_STRAND_COLORS.length];
        return (
          <line
            key={idx}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            stroke={c}
            strokeWidth="5"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};
