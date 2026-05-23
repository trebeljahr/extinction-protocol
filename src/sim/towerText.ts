import enTowers from "../locales/en/towers.json";
import type { TowerKind } from "./types";

// English tower copy. Source of truth is src/locales/en/towers.json; these
// typed Records are the English view used by non-localized consumers (the
// Compendium). Localized surfaces read the same keys via react-i18next.
type Entry = { subtitle: string; description: string; behavior: string; matchups: string };

const cat = enTowers as Record<TowerKind, Entry>;

const TOWER_KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar", "flame", "hive"];

const pick = (get: (e: Entry) => string): Record<TowerKind, string> =>
  Object.fromEntries(TOWER_KINDS.map((k) => [k, get(cat[k])])) as Record<TowerKind, string>;

export const TOWER_SUBTITLE: Record<TowerKind, string> = pick((e) => e.subtitle);
export const TOWER_DESCRIPTION: Record<TowerKind, string> = pick((e) => e.description);
export const TOWER_BEHAVIOR: Record<TowerKind, string> = pick((e) => e.behavior);
export const TOWER_MATCHUPS: Record<TowerKind, string> = pick((e) => e.matchups);
