import type { ReactNode } from "react";
import type { EnemyKind } from "../sim/types";

type Props = {
  kind: EnemyKind;
  className?: string;
  size?: number;
};

// Inline SVG side-view silhouettes for each enemy kind. Same pattern as
// DifficultyIcon: 64×64 viewBox, currentColor everywhere so the parent
// drives tint, head facing right by convention.
export const EnemyIcon = ({ kind, className, size }: Props) => {
  const dim = size !== undefined ? { width: size, height: size } : undefined;
  switch (kind) {
    case "raptor":
      return <RaptorIcon className={className} {...dim} />;
    case "swarm":
      return <SwarmIcon className={className} {...dim} />;
    case "para":
      return <ParaIcon className={className} {...dim} />;
    case "allosaur":
      return <AllosaurIcon className={className} {...dim} />;
    case "stego":
      return <StegoIcon className={className} {...dim} />;
    case "armored":
      return <ArmoredIcon className={className} {...dim} />;
    case "titan":
      return <TitanIcon className={className} {...dim} />;
    case "boss":
      return <BossIcon className={className} {...dim} />;
  }
};

type IconProps = { className?: string; width?: number; height?: number };

const SvgBase = ({ children, className, width, height }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 64 64"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width={width}
    height={height}
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Raptor — slim bipedal theropod, head right, raised killer claw.
const RaptorIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M4 40 Q14 32 24 30 Q28 22 36 18 Q44 14 50 16 Q56 17 60 21 L57 24 L52 25 L51 30 Q50 34 47 35 L49 50 L44 50 L41 42 L34 42 L36 52 L31 52 L29 42 Q24 42 22 46 L17 46 Q12 44 6 46 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M22 46 L20 54 L25 50 Z" fill="currentColor" />
    <circle cx="52" cy="20" r="1.4" fill="#0b1016" />
  </SvgBase>
);

// Swarm — three small theropods running in a pack. One bold foreground
// raptor, two clearer mid-size ones flanking behind it.
const SwarmIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <g opacity="0.65">
      <path
        d="M2 26 Q8 20 14 18 Q18 12 24 12 Q28 13 30 16 L32 14 L29 20 L26 21 L26 25 L25 28 L22 28 L21 25 L18 26 L17 24 Q12 24 6 28 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="16" r="0.8" fill="#0b1016" />
    </g>
    <g opacity="0.65">
      <path
        d="M30 22 Q36 16 44 14 Q50 10 56 12 Q60 13 62 16 L62 18 L58 19 L54 20 L54 24 L53 27 L50 27 L49 24 L46 25 L45 23 Q40 24 34 26 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="16" r="0.8" fill="#0b1016" />
    </g>
    <path
      d="M2 50 Q12 42 22 40 Q26 32 34 28 Q44 24 52 26 Q56 27 60 30 L57 33 L52 34 L52 40 Q51 44 48 45 L50 58 L45 58 L42 50 L34 50 L36 60 L31 60 L29 50 Q24 50 22 54 L17 54 Q12 52 4 54 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M22 54 L20 62 L26 58 Z" fill="currentColor" />
    <circle cx="55" cy="30" r="1.4" fill="#0b1016" />
  </SvgBase>
);

// Parasaurolophus — bipedal hadrosaur with a fat backward-and-upward
// curving cranial crest tube. The crest is the species' silhouette tell.
const ParaIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M4 42 Q12 38 20 36 Q28 32 36 28 Q42 26 46 26 Q50 28 52 32 Q54 35 56 36 L60 36 L60 40 L56 41 L50 41 L50 50 L46 50 L46 42 L34 42 L34 52 L30 52 L30 42 Q22 40 16 42 Q10 40 6 42 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M48 26 Q40 18 30 12 Q24 8 22 12 Q24 16 30 18 Q40 22 50 30 Z"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <circle cx="54" cy="34" r="1.2" fill="#0b1016" />
  </SvgBase>
);

// Allosaur (T-Rex) — heavy bipedal predator, massive head, tiny arms.
const AllosaurIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M2 44 Q12 34 22 32 Q26 22 34 18 Q44 12 56 14 L62 16 L62 24 L58 28 L57 32 Q56 36 52 38 L54 52 L48 52 L45 42 L33 42 L36 54 L29 54 L26 42 Q22 42 20 46 L14 46 Q9 44 4 46 Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M50 28 L62 22 L62 26 L52 32 Z" fill="#0b1016" opacity="0.55" />
    <circle cx="56" cy="20" r="1.7" fill="#0b1016" />
    <path d="M40 34 L36 38 L40 38 Z" fill="currentColor" />
  </SvgBase>
);

// Stegosaurus — quadruped with kite plates along the spine and thagomizer.
const StegoIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M6 38 L10 36 Q16 32 24 30 Q34 28 42 30 Q50 32 56 36 L60 36 L60 40 L56 42 L52 44 L52 50 L48 50 L48 44 L26 44 L26 50 L22 50 L22 44 L10 42 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M14 32 L17 24 L21 32 Z" stroke="currentColor" strokeWidth="0.8" />
    <path d="M22 30 L26 22 L30 30 Z" stroke="currentColor" strokeWidth="0.8" />
    <path d="M32 29 L36 20 L40 29 Z" stroke="currentColor" strokeWidth="0.8" />
    <path d="M42 30 L46 22 L50 30 Z" stroke="currentColor" strokeWidth="0.8" />
    <path
      d="M6 38 L1 34 M6 38 L0 38 M6 38 L1 42"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="58" cy="38" r="1.1" fill="#0b1016" />
  </SvgBase>
);

// Triceratops (Armored) — stocky quadruped, with a small forward-jutting
// face that has the eye and horns, and a tall scalloped frill arching
// up-and-behind the head.
const ArmoredIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M4 38 Q14 36 22 36 Q34 36 42 34 Q48 30 52 30 L56 32 L58 32 L60 30 L62 32 L62 36 L60 38 L56 38 L52 40 L52 50 L48 50 L48 42 L26 42 L26 50 L22 50 L22 42 L10 40 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M40 32 Q34 22 36 12 L40 6 L44 8 L48 4 L52 8 L56 4 L60 10 L62 16 L62 24 Q60 28 56 30 Q50 30 46 30 Z"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <path
      d="M58 30 L63 28 L63 31 L58 32 Z"
      stroke="currentColor"
      strokeWidth="0.5"
      fill="currentColor"
    />
    <path d="M61 35 L62 31 L63 35 Z" stroke="currentColor" strokeWidth="0.4" fill="currentColor" />
    <circle cx="55" cy="34" r="1" fill="#0b1016" />
  </SvgBase>
);

// Apatosaurus (Titan) — sauropod with long arched neck + long tail.
const TitanIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M2 40 Q12 36 22 34 Q34 32 44 32 Q52 32 56 28 Q58 22 56 16 Q53 8 53 4 Q56 2 60 4 L62 8 L60 12 L57 12 Q54 14 53 18 Q52 22 50 26 Q48 30 48 32 L50 42 L50 50 L46 50 L46 42 L36 42 L36 50 L32 50 L32 42 L20 42 L20 50 L16 50 L16 42 L8 40 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="58" cy="6" r="1" fill="#0b1016" />
  </SvgBase>
);

// Matriarch (Boss) — same sauropod silhouette, more imposing: lunging
// head with open jaw, dorsal spikes, glowing eye halo.
const BossIcon = ({ className, ...rest }: IconProps) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M2 42 Q12 38 22 36 Q34 34 44 32 Q52 30 56 26 Q60 20 58 14 Q56 8 58 6 Q62 4 63 8 L63 14 L60 16 L58 18 L62 20 L60 22 L57 21 Q54 24 53 28 Q52 32 51 34 L52 42 L52 50 L48 50 L48 42 L36 42 L36 50 L32 50 L32 42 L20 42 L20 50 L16 50 L16 42 L8 42 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M28 32 L30 27 L33 32 Z" fill="currentColor" />
    <path d="M36 30 L39 24 L42 30 Z" fill="currentColor" />
    <path d="M44 30 L47 24 L50 30 Z" fill="currentColor" />
    <path
      d="M58 18 L62 17 L62 21 L60 22 Z"
      fill="#0b1016"
      stroke="currentColor"
      strokeWidth="0.4"
    />
    <circle cx="60" cy="11" r="1.6" fill="#0b1016" />
    <circle
      cx="60"
      cy="11"
      r="2.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.7"
      opacity="0.55"
    />
  </SvgBase>
);
