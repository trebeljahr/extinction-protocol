import { useIsMobile, useIsPortrait } from "./useMediaQuery";

// Full-screen "rotate to landscape" overlay shown only on mobile while
// in portrait. The HUD layout assumes a wide aspect — towers below,
// stats above, panels on the side — so portrait feels broken without
// this prompt. Sits above the HUD/Canvas (z-50) but below modal panels
// like the new-enemy alert (z-50) so it doesn't block their dismiss
// gestures; in practice the player sees this *first* and rotates.
export const LandscapeNudge = () => {
  const isMobile = useIsMobile();
  const isPortrait = useIsPortrait();
  if (!isMobile || !isPortrait) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-[rgba(8,12,18,0.94)] flex flex-col items-center justify-center text-center px-8 backdrop-blur-md">
      <div className="text-[64px] mb-6 animate-[rotateNudge_2.4s_ease-in-out_infinite]">
        <RotateGlyph />
      </div>
      <div className="font-display text-[22px] font-bold tracking-[0.04em] text-white mb-2">
        Rotate to landscape
      </div>
      <div className="text-[13px] text-fg-muted leading-[1.5] max-w-[280px]">
        Extinction Protocol plays best with the screen turned sideways.
      </div>
    </div>
  );
};

const RotateGlyph = () => (
  // Inline SVG so we don't ship an extra asset for a single icon.
  // Stylized phone with a rotation arc — keeps tone consistent with
  // the sci-fi UI (no emoji, no emoji-flavored color).
  <svg
    width="84"
    height="84"
    viewBox="0 0 84 84"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <title>Rotate device</title>
    <rect
      x="22"
      y="6"
      width="32"
      height="56"
      rx="5"
      stroke="#9fd8ff"
      strokeWidth="2.5"
      transform="rotate(-30 38 34)"
    />
    <path
      d="M14 64 Q 42 80 70 64"
      stroke="#ffd66a"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M70 64 L 64 60 M 70 64 L 66 70"
      stroke="#ffd66a"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);
