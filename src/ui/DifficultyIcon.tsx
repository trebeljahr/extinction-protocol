import type { ReactNode } from "react";
import type { Difficulty } from "../progress";

type Props = {
  difficulty: Difficulty;
  className?: string;
  size?: number;
};

// Inline SVG dino silhouettes, sized to a 64×64 viewBox so a single stroke
// width reads consistently at any rendered size. `currentColor` everywhere
// so the parent can drive the tint via Tailwind text utilities.
export const DifficultyIcon = ({ difficulty, className, size }: Props) => {
  const dim = size !== undefined ? { width: size, height: size } : undefined;
  switch (difficulty) {
    case "easy":
      return <HerbivoreIcon className={className} {...dim} />;
    case "medium":
      return <RaptorIcon className={className} {...dim} />;
    case "hard":
      return <TrexIcon className={className} {...dim} />;
    case "extinction":
      return <AsteroidSkullIcon className={className} {...dim} />;
  }
};

const SvgBase = ({
  children,
  className,
  width,
  height,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
  height?: number;
}) => (
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

// Easy — small grazing herbivore (compsognathus-ish): low body, long tail,
// short neck, cheerful posture.
const HerbivoreIcon = ({
  className,
  ...rest
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M11 44 Q14 32 24 30 Q28 22 36 22 Q42 22 45 27 L52 25 L48 32 Q49 36 47 39 L48 50 L43 50 L42 44 L34 44 L33 50 L28 50 L28 44 Q21 44 18 49 L13 49 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="42" cy="27" r="1.4" fill="#0b1016" />
  </SvgBase>
);

// Medium — raptor in mid-stride: pronounced sickle claw, low slung tail,
// reaching head.
const RaptorIcon = ({
  className,
  ...rest
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M6 38 Q14 30 24 30 Q26 22 32 18 Q40 14 50 16 L56 14 L51 22 Q50 26 47 28 L48 32 Q47 36 44 38 L46 50 L41 50 L39 44 L34 44 L36 52 L31 52 L29 44 Q24 44 22 48 L18 48 Q15 44 11 44 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M22 48 L20 54 L24 51 Z" fill="currentColor" />
    <circle cx="49" cy="20" r="1.4" fill="#0b1016" />
  </SvgBase>
);

// Hard — T-Rex: massive head, tiny arms, heavy tail, dominant stance.
const TrexIcon = ({
  className,
  ...rest
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M4 44 Q12 36 22 36 Q24 26 34 20 Q44 14 56 18 L60 14 L58 24 L54 28 L55 33 Q54 38 50 39 L52 52 L46 52 L43 42 L33 42 L36 54 L29 54 L26 42 Q22 42 20 46 L14 46 Q9 44 6 48 Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M50 28 L57 26 L57 30 L51 31 Z" fill="#0b1016" opacity="0.7" />
    <circle cx="52" cy="22" r="1.6" fill="#0b1016" />
    <path d="M40 32 L37 35 L40 36 Z" fill="currentColor" />
  </SvgBase>
);

// Extinction — flaming asteroid streaking past a horned dino skull. The
// asteroid sells the "the meteor is here" tagline, the skull underneath
// hammers home the stakes.
const AsteroidSkullIcon = ({
  className,
  ...rest
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <SvgBase className={className} {...rest}>
    <path
      d="M52 4 L58 10 L48 12 L54 16 L46 18 L52 22 L42 22 L36 16 L40 8 L48 6 Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      opacity="0.95"
    />
    <path
      d="M44 20 L36 26 L26 22 L18 28 L8 26 L4 14 Q14 8 26 12"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
      opacity="0.55"
    />
    <path
      d="M14 36 Q14 28 24 26 Q34 24 42 30 Q50 36 48 46 L46 52 L40 52 L40 48 Q36 50 32 50 Q28 50 24 48 L24 52 L18 52 L16 46 Q12 42 14 36 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="22" cy="38" r="2.2" fill="#0b1016" />
    <circle cx="34" cy="38" r="2.2" fill="#0b1016" />
    <path d="M26 44 L28 47 L30 44 L32 47 L34 44" stroke="#0b1016" strokeWidth="1" fill="none" />
    <path
      d="M10 30 L4 28 M14 24 L8 18 M18 22 L14 14"
      stroke="currentColor"
      strokeWidth="1.4"
      opacity="0.7"
      strokeLinecap="round"
    />
  </SvgBase>
);
