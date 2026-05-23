// Lore codex structure. One found-document fragment per level (1–30),
// unlocked when the level is cleared on any mode. The display copy
// (title, author, source, body) and the kind labels live in the i18n
// catalog at src/locales/<lng>/lore.json; this module only carries the
// per-fragment `kind` (drives which kind label to show) and the render
// order. See docs/STORY.md for the voice bible behind the prose.

export type LoreFragmentKind =
  | "memo"
  | "letter"
  | "log"
  | "report"
  | "transcript"
  | "note"
  | "directive"
  | "intercept";

// Per-fragment document kind. Keyed by level id; the title/author/source/
// body for each id are read from the `lore:fragments.<id>.*` catalog.
export const LORE_FRAGMENT_KIND: Record<number, LoreFragmentKind> = {
  1: "memo",
  2: "log",
  3: "log",
  4: "memo",
  5: "note",
  6: "letter",
  7: "report",
  8: "report",
  9: "report",
  10: "log",
  11: "report",
  12: "report",
  13: "note",
  14: "memo",
  15: "report",
  16: "intercept",
  17: "memo",
  18: "note",
  19: "report",
  20: "directive",
  21: "report",
  22: "note",
  23: "note",
  24: "memo",
  25: "memo",
  26: "report",
  27: "note",
  28: "note",
  29: "log",
  30: "transcript",
};

export const LORE_FRAGMENT_ORDER: number[] = Object.keys(LORE_FRAGMENT_KIND)
  .map((k) => Number(k))
  .sort((a, b) => a - b);
