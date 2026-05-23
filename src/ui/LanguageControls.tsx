import { useTranslation } from "react-i18next";
import {
  changeLanguage,
  type LanguageCode,
  SUPPORTED_LANGUAGES,
  TRANSLATION_PROJECT_URL,
} from "../i18n";
import { IconGlobe } from "./MenuIcons";

// Language selector styled to match SoundControls / FullscreenToggle: a
// settings-section card with a gold eyebrow header and a row of toggle
// buttons. Language names are endonyms (shown in their own language) and so
// are intentionally NOT run through t(). The "Help translate" link only
// renders once TRANSLATION_PROJECT_URL is configured.
export const LanguageControls = () => {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section className="settings-section language-controls-section bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg pt-3 px-4 pb-3 mb-5">
      <div className="settings-section-header flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-uber text-gold">
          <IconGlobe size={14} className="shrink-0" />
          {t("language.title")}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = current === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLanguage(lang.code as LanguageCode)}
              aria-pressed={active}
              className={`min-h-11 flex-1 min-w-[88px] px-3 rounded-[6px] border text-xs font-bold font-[inherit] cursor-pointer transition-colors ${
                active
                  ? "bg-[rgba(61,209,255,0.12)] border-[rgba(61,209,255,0.4)] text-cyan"
                  : "bg-surface-1 border-border text-fg-secondary hover:border-blue hover:text-white"
              }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
      {TRANSLATION_PROJECT_URL && (
        <a
          href={TRANSLATION_PROJECT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-block text-[11px] text-fg-muted underline decoration-dotted underline-offset-2 hover:text-cyan"
        >
          {t("language.helpTranslate")}
        </a>
      )}
    </section>
  );
};
