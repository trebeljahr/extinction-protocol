import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import deAchievements from "../locales/de/achievements.json";
import deEnemies from "../locales/de/enemies.json";
import deLevels from "../locales/de/levels.json";
import deLore from "../locales/de/lore.json";
import deMechanics from "../locales/de/mechanics.json";
import deModes from "../locales/de/modes.json";
import deRobots from "../locales/de/robots.json";
import deSkills from "../locales/de/skills.json";
import deTowers from "../locales/de/towers.json";
import deUi from "../locales/de/ui.json";
import deUpgrades from "../locales/de/upgrades.json";
import enAchievements from "../locales/en/achievements.json";
import enEnemies from "../locales/en/enemies.json";
import enLevels from "../locales/en/levels.json";
import enLore from "../locales/en/lore.json";
import enMechanics from "../locales/en/mechanics.json";
import enModes from "../locales/en/modes.json";
import enRobots from "../locales/en/robots.json";
import enSkills from "../locales/en/skills.json";
import enTowers from "../locales/en/towers.json";
import enUi from "../locales/en/ui.json";
import enUpgrades from "../locales/en/upgrades.json";

// Only en + de are wired into the runtime bundle. zh-CN and pt-BR exist on
// disk as contributor starting points (see src/locales/) but are NOT loaded
// here and must not be advertised as supported until a real translation
// lands and is added to SUPPORTED_LANGUAGES + the resources map below.
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// In-game "Help translate" entry point. Left undefined until the
// Weblate/Crowdin project exists; the settings link only renders when set.
export const TRANSLATION_PROJECT_URL: string | undefined = undefined;

export const NAMESPACES = [
  "ui",
  "enemies",
  "towers",
  "mechanics",
  "achievements",
  "modes",
  "lore",
  "levels",
  "robots",
  "skills",
  "upgrades",
] as const;

const STORAGE_KEY = "mesozoic-protocol:lang";
const DEFAULT_LANGUAGE: LanguageCode = "en";

const isSupported = (code: string): code is LanguageCode =>
  SUPPORTED_LANGUAGES.some((l) => l.code === code);

// Resolve the initial language: an explicit saved choice wins, otherwise
// fall back to the browser's primary language, otherwise English.
const detectLanguage = (): LanguageCode => {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isSupported(saved)) return saved;
    } catch {
      // localStorage can throw in private mode — fall through to navigator.
    }
  }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  const base = nav.toLowerCase().split("-")[0];
  return isSupported(base) ? base : DEFAULT_LANGUAGE;
};

const persistLanguage = (code: LanguageCode): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Best-effort; a failed persist just means the choice won't survive reload.
  }
};

const resources = {
  en: {
    ui: enUi,
    enemies: enEnemies,
    towers: enTowers,
    mechanics: enMechanics,
    achievements: enAchievements,
    modes: enModes,
    lore: enLore,
    levels: enLevels,
    robots: enRobots,
    skills: enSkills,
    upgrades: enUpgrades,
  },
  de: {
    ui: deUi,
    enemies: deEnemies,
    towers: deTowers,
    mechanics: deMechanics,
    achievements: deAchievements,
    modes: deModes,
    lore: deLore,
    levels: deLevels,
    robots: deRobots,
    skills: deSkills,
    upgrades: deUpgrades,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES.map((l) => l.code)],
  ns: [...NAMESPACES],
  defaultNS: "ui",
  // React already escapes interpolated values, so disable i18next's escaping
  // to avoid double-encoding (e.g. apostrophes, ×).
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled, so init is effectively synchronous; skipping
  // Suspense keeps the first paint flash-free without a boundary per panel.
  react: { useSuspense: false },
});

const applyHtmlLang = (lng: string): void => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
};

applyHtmlLang(i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export const changeLanguage = (code: LanguageCode): void => {
  persistLanguage(code);
  void i18n.changeLanguage(code);
};

export default i18n;
