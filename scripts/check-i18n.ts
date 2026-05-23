/**
 * i18n catalog completeness check.
 *
 *   pnpm check:i18n
 *   npx tsx scripts/check-i18n.ts
 *
 * `en` is the source of truth. Every other locale directory under
 * src/locales/ must mirror it exactly:
 *
 *   1. Fails (exit non-zero) if a locale is missing any key present in en.
 *   2. Fails if a locale has an extra key not present in en.
 *   3. Warns (does not fail) when a UI string is >40% longer than its English
 *      source — a heuristic for buttons/labels that may clip in the layout.
 *
 * Stub locales (zh-CN, pt-BR) are en copies and so pass parity trivially until
 * a contributor starts translating them; that is intentional.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(HERE, "..", "src", "locales");
const REFERENCE = "en";
const NAMESPACES = [
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
];

// Overflow heuristic: only the chrome namespace (ui) drives layout-sensitive
// buttons/labels. Prose namespaces vary in length by nature.
const LENGTH_WARN_NS = new Set(["ui"]);
const LENGTH_WARN_RATIO = 1.4;
const LENGTH_WARN_MIN_SOURCE = 4;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const flatten = (
  value: Json,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> => {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
};

const loadNamespace = (locale: string, ns: string): Record<string, string> | null => {
  const file = join(LOCALES_DIR, locale, `${ns}.json`);
  if (!existsSync(file)) return null;
  return flatten(JSON.parse(readFileSync(file, "utf8")) as Json);
};

let errors = 0;
let warnings = 0;
const fail = (message: string) => {
  errors++;
  console.error(`  ✗ ${message}`);
};
const warn = (message: string) => {
  warnings++;
  console.warn(`  ⚠ ${message}`);
};

const reference: Record<string, Record<string, string>> = {};
for (const ns of NAMESPACES) {
  const loaded = loadNamespace(REFERENCE, ns);
  if (!loaded) {
    console.error(`Missing reference namespace ${REFERENCE}/${ns}.json`);
    process.exit(1);
  }
  reference[ns] = loaded;
}

const localeDirs = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== REFERENCE)
  .map((entry) => entry.name)
  .sort();

if (localeDirs.length === 0) {
  console.error("No locales found beyond the reference; nothing to check.");
  process.exit(1);
}

for (const locale of localeDirs) {
  console.log(`\n${locale}:`);
  for (const ns of NAMESPACES) {
    const refKeys = reference[ns];
    const target = loadNamespace(locale, ns);
    if (!target) {
      fail(`${ns}: ${locale}/${ns}.json is missing`);
      continue;
    }
    const refSet = new Set(Object.keys(refKeys));
    const targetSet = new Set(Object.keys(target));

    for (const key of refSet) {
      if (!targetSet.has(key)) fail(`${ns}: missing key "${key}"`);
    }
    for (const key of targetSet) {
      if (!refSet.has(key)) fail(`${ns}: extra key "${key}" not in ${REFERENCE}`);
    }

    if (LENGTH_WARN_NS.has(ns)) {
      for (const key of refSet) {
        if (!targetSet.has(key)) continue;
        const source = refKeys[key];
        const translated = target[key];
        if (
          source.length >= LENGTH_WARN_MIN_SOURCE &&
          translated.length > source.length * LENGTH_WARN_RATIO
        ) {
          const pct = Math.round((translated.length / source.length - 1) * 100);
          warn(
            `${ns}: "${key}" is ${pct}% longer than ${REFERENCE} ("${source}" → "${translated}")`,
          );
        }
      }
    }
  }
}

console.log("");
if (errors > 0) {
  console.error(
    `✗ ${errors} error(s), ${warnings} length warning(s) across ${localeDirs.length} locale(s)`,
  );
  process.exit(1);
}
console.log(`✓ ${localeDirs.join(", ")} complete vs ${REFERENCE} — ${warnings} length warning(s)`);
process.exit(0);
