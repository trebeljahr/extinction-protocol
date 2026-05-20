import type { ReactNode } from "react";
import { DIFFICULTY_LABEL } from "../progress";
import { useGame } from "../store";
import { DifficultyTag } from "./DifficultyTag";

type Props = {
  className: string;
  label?: string;
  size?: "sm" | "md";
  title?: string;
  textStackClassName?: string;
  trailing?: ReactNode;
  onBeforeOpen?: () => void;
};

export const DifficultyButton = ({
  className,
  label,
  size,
  title,
  textStackClassName,
  trailing,
  onBeforeOpen,
}: Props) => {
  const difficulty = useGame((s) => s.progress.difficulty);
  const setDifficultyPickerOpen = useGame((s) => s.setDifficultyPickerOpen);

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        setDifficultyPickerOpen(true);
      }}
      className={`difficulty-open-button pointer-events-auto ${className}`}
      title={title ?? `Difficulty · ${DIFFICULTY_LABEL[difficulty]} · Change`}
      aria-label="Change difficulty"
    >
      <DifficultyTag
        difficulty={difficulty}
        label={label}
        size={size}
        textStackClassName={textStackClassName}
      />
      {trailing}
    </button>
  );
};
