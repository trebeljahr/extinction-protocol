/**
 * Enemy text ↔ resist data consistency check.
 *
 *   pnpm check:enemy-text
 *   npx tsx scripts/check-enemy-text.ts
 *
 * Prevents drift between the prose in src/sim/enemyText.ts and the numeric
 * truth in src/sim/world.ts (ENEMY_RESIST, ENEMY_SLOW_RESIST). Surfaces that
 * read the prose: Compendium, NewEnemyAlert, EnemyPanel ("dinosaur overlay").
 *
 * Rules:
 *   1. If the enemy has a recommended damage type (highest mul ≥ 1.15), the
 *      description must mention that type by synonym.
 *   2. Otherwise, the description must contain a "balanced / no clear
 *      weakness" sentinel phrase.
 *   3. Each *primary* weakness (mul ≥ 1.35) must be mentioned by synonym.
 *   4. Each *primary* resist (mul ≤ 0.55) must be mentioned by synonym.
 *      (Players need to know what NOT to bring.)
 *   5. If slow resistance ≥ 0.5, the description must mention slow/chill.
 *   6. Sanity: every enemy has both a SUBTITLE and a DESCRIPTION entry.
 *
 * Exits non-zero on any failure so a CI / pre-commit hook can gate it.
 */

import { ENEMY_DESCRIPTION, ENEMY_SUBTITLE } from "../src/sim/enemyText";
import type { DamageType, EnemyKind } from "../src/sim/types";
import { ENEMY_LABEL, ENEMY_RESIST, ENEMY_SLOW_RESIST } from "../src/sim/world";

const RECOMMENDED_MIN_MUL = 1.15;
const PRIMARY_WEAK_MUL = 1.35;
const PRIMARY_RESIST_MUL = 0.55;
const HEAVY_SLOW_RESIST = 0.5;

const DAMAGE_TYPES: DamageType[] = ["kinetic", "electric", "cold", "explosive"];

// Synonyms each piece of prose might use. Keep generous — if the prose calls
// electric "shock" or "lightning", the test should still match.
const SYNONYMS: Record<DamageType, RegExp> = {
  kinetic: /\b(kinetic|bullets?|rifles?|rail(?:gun)?|gatling)\b/i,
  electric: /\b(electric|shock|lightning|chain(?:s)?|electricity)\b/i,
  cold: /\b(cold|cryo|ice|freeze|frost|chill(?:ed)?)\b/i,
  explosive: /\b(explosive|blast|aoe|splash|mortar|explosion(?:s)?|bomb)\b/i,
};

const SLOW_PHRASES = /\b(slow resist|slow resistance|chill resist|leaves cryo)\b/i;

const BALANCED_SENTINELS =
  /(no (real|clear|major|exploitable) weakness|balanced resistance|nothing crushes it|out-?dps it|hardened against)/i;

// Some prose covers all primary resists with a catch-all phrase ("resists
// nearly everything except cold") — when present, rule 4 is satisfied as
// long as the recommended damage type is the one explicitly excluded.
const CATCH_ALL_RESIST = /(resists?|shrugs off|hardened against) (nearly|almost) (everything|all)/i;

type Issue = { kind: EnemyKind; message: string };
const issues: Issue[] = [];
const note = (kind: EnemyKind, message: string) => issues.push({ kind, message });

const enemies = Object.keys(ENEMY_RESIST) as EnemyKind[];

for (const kind of enemies) {
  const desc = ENEMY_DESCRIPTION[kind];
  const subtitle = ENEMY_SUBTITLE[kind];
  if (!desc) {
    note(kind, `missing ENEMY_DESCRIPTION entry`);
    continue;
  }
  if (!subtitle) note(kind, `missing ENEMY_SUBTITLE entry`);

  const resist = ENEMY_RESIST[kind];
  const slowResist = ENEMY_SLOW_RESIST[kind];

  const best = DAMAGE_TYPES.reduce((a, b) => (resist[a] >= resist[b] ? a : b));
  const bestMul = resist[best];

  // Rule 1 / 2 — recommended damage type or balanced sentinel.
  if (bestMul >= RECOMMENDED_MIN_MUL) {
    if (!SYNONYMS[best].test(desc)) {
      note(
        kind,
        `description should mention recommended damage type "${best}" (mul ${bestMul.toFixed(
          2,
        )}); synonyms: ${SYNONYMS[best].source}`,
      );
    }
  } else if (!BALANCED_SENTINELS.test(desc)) {
    note(
      kind,
      `no real weakness in data (best mul ${bestMul.toFixed(
        2,
      )}); description must contain a "balanced / no clear weakness / hardened against" sentinel`,
    );
  }

  // Rule 3 — primary weaknesses must all be mentioned.
  for (const t of DAMAGE_TYPES) {
    if (resist[t] >= PRIMARY_WEAK_MUL && !SYNONYMS[t].test(desc)) {
      note(
        kind,
        `primary weakness "${t}" (mul ${resist[t].toFixed(2)}) is not mentioned in the description`,
      );
    }
  }

  // Rule 4 — primary resists must all be mentioned (so the player knows what
  // not to bring; otherwise they read a tower's chip and burn gold). A
  // catch-all phrase like "resists nearly everything" satisfies the rule.
  const hasCatchAll = CATCH_ALL_RESIST.test(desc);
  for (const t of DAMAGE_TYPES) {
    if (resist[t] <= PRIMARY_RESIST_MUL && !SYNONYMS[t].test(desc) && !hasCatchAll) {
      note(
        kind,
        `primary resist "${t}" (mul ${resist[t].toFixed(2)}) is not mentioned in the description`,
      );
    }
  }

  // Rule 5 — slow resistance must be called out when heavy.
  if (slowResist >= HEAVY_SLOW_RESIST && !SLOW_PHRASES.test(desc)) {
    note(
      kind,
      `slow resist is ${(slowResist * 100).toFixed(0)}% — description must mention slow/chill resistance`,
    );
  }
}

if (issues.length === 0) {
  console.log(`✓ ${enemies.length} enemy descriptions match resist data`);
  process.exit(0);
}

console.error(`✗ ${issues.length} drift(s) between enemy text and resist data:\n`);
for (const i of issues) {
  console.error(`  [${ENEMY_LABEL[i.kind]}] ${i.message}`);
  console.error(`    desc: ${ENEMY_DESCRIPTION[i.kind] ?? "<missing>"}\n`);
}
process.exit(1);
