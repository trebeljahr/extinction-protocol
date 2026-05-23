// Per-level briefing + command-update copy. The text now lives in the
// i18n catalog (src/locales/<lng>/levels.json) under `briefings.<id>` and
// `interstitials.<id>`; display surfaces (LevelIntro, the world-map hover
// tooltip) read it via react-i18next. This module only exposes which level
// ids actually carry a briefing / interstitial so the store can gate the
// intro overlay and the UI can guard the optional command-update block.
//
// Voice bible (terse on-station operator for briefings, command-memo for
// interstitials) is documented in docs/STORY.md.

import enLevels from "../locales/en/levels.json";

const BRIEFING_IDS = new Set(Object.keys(enLevels.briefings).map(Number));
const INTERSTITIAL_IDS = new Set(Object.keys(enLevels.interstitials).map(Number));

export const hasLevelBriefing = (id: number): boolean => BRIEFING_IDS.has(id);
export const hasLevelInterstitial = (id: number): boolean => INTERSTITIAL_IDS.has(id);
