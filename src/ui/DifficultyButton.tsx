import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      title={
        title ??
        t("difficulty.buttonTitle", { difficulty: t(`modes:difficulty.label.${difficulty}`) })
      }
      aria-label={t("difficulty.changeAria")}
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
