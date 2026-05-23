import { useTranslation } from "react-i18next";
import { useGame } from "../store";
import { MenuOverlay } from "./MenuOverlay";

// One-shot reveal shown on the world map the first time the player has
// cleared the final campaign outpost. Mirrors ModesUnlockedModal; the
// dismissed flag is persisted so it never reappears on this slot.
export const EndlessUnlockedModal = () => {
  const { t } = useTranslation();
  const dismiss = useGame((s) => s.dismissEndlessUnlockExplainer);

  return (
    <MenuOverlay
      title={t("endlessUnlocked.title")}
      subtitle={t("endlessUnlocked.subtitle")}
      onClose={dismiss}
      closeLabel={t("endlessUnlocked.close")}
      cardClassName="!max-w-[560px]"
    >
      <p className="text-[13px] leading-snug text-fg-muted mb-4">{t("endlessUnlocked.body")}</p>
      <div className="flex justify-end mt-5">
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          {t("endlessUnlocked.close")}
        </button>
      </div>
    </MenuOverlay>
  );
};
