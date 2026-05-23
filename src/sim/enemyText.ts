import enEnemies from "../locales/en/enemies.json";
import type { BossVariant, EnemyKind } from "./types";

// English enemy field-notes. The source of truth is the i18n catalog at
// src/locales/en/enemies.json; these typed Records are the English view of
// it, kept for non-localized consumers (Compendium, NewEnemyAlert) and the
// scripts/check-enemy-text.ts resist-data cross-check. Localized surfaces
// (EnemyPanel) read the same keys via react-i18next instead.
type Entry = { subtitle: string; description: string };
type Catalog = Record<EnemyKind, Entry> & { matriarch: Record<BossVariant, Entry> };

const cat = enEnemies as unknown as Catalog;

const ENEMY_KINDS: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
  "boss",
];
const BOSS_VARIANTS: BossVariant[] = ["raptor", "stego", "para", "allosaur", "armored", "apex"];

const pick = <K extends string>(keys: K[], get: (k: K) => string): Record<K, string> =>
  Object.fromEntries(keys.map((k) => [k, get(k)])) as Record<K, string>;

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = pick(ENEMY_KINDS, (k) => cat[k].subtitle);

export const ENEMY_DESCRIPTION: Record<EnemyKind, string> = pick(
  ENEMY_KINDS,
  (k) => cat[k].description,
);

export const MATRIARCH_SUBTITLE: Record<BossVariant, string> = pick(
  BOSS_VARIANTS,
  (v) => cat.matriarch[v].subtitle,
);

export const MATRIARCH_DESCRIPTION: Record<BossVariant, string> = pick(
  BOSS_VARIANTS,
  (v) => cat.matriarch[v].description,
);
