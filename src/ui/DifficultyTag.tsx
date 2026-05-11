import { DIFFICULTY_ACCENT, DIFFICULTY_LABEL, type Difficulty } from "../progress";
import { DifficultyModelIcon } from "./DifficultyModelIcon";

type Props = {
  difficulty: Difficulty;
  label?: string;
  size?: "sm" | "md";
  textStackClassName?: string;
};

// The icon + 2-line eyebrow/name stack shared by the difficulty chips in
// HUD, PauseMenu and WorldMapUI. Returns a fragment so the caller's flex
// container drives gap and ordering; trailing content (e.g. a "Change"
// hint) can sit alongside this in the parent.
export const DifficultyTag = ({
  difficulty,
  label = "Difficulty",
  size = "md",
  textStackClassName = "",
}: Props) => {
  const accent = DIFFICULTY_ACCENT[difficulty];
  const iconClass = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const nameClass = size === "sm" ? "text-[13px]" : "text-sm";
  return (
    <>
      <DifficultyModelIcon difficulty={difficulty} className={iconClass} />
      <div className={`flex flex-col items-start ${textStackClassName}`}>
        <span className="text-[9px] font-bold tracking-wide text-gold uppercase">{label}</span>
        <span className={`${nameClass} font-bold leading-tight ${accent.text}`}>
          {DIFFICULTY_LABEL[difficulty]}
        </span>
      </div>
    </>
  );
};
