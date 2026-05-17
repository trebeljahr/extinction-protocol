# Adaptive Resistance

Playtest note 10, item 14. Builds on item 13 (static per-type resists already shipped at `ENEMY_RESIST` in `src/sim/world.ts:790`).

The herd should _actually_ adapt to the damage type the player is leaning on, telegraphed visually by an off-color tint that intensifies in later levels.

---

## Narrative anchor

`LEVEL_INTERSTITIAL[11]` (`src/levels/briefings.ts:95`) is the SITREP that names the adaptation loop: _"every kill seeds the next wave, because the conditioning network selects against the round that killed the last one. We have been training the herd."_

Adaptation behavior turns on **starting L12** — the level after the announcement, so the SITREP is paid off mechanically on the very next wave.

---

## Tracking the player's dominant damage type

New world-level rolling tally, updated inside `applyDamage` (`src/sim/world.ts:1060`).

```ts
// On World
adaptation: {
  // Per-wave damage-by-type buckets. Indexed by wave number; we only
  // ever read the last N entries so old buckets can be reaped.
  perWave: Map<number, Record<DamageType, number>>;
  // Cached dominant type for the *next* spawn batch. Recomputed at the
  // start of each wave from the last N buckets.
  dominantNext: DamageType | null;
};
```

- **Bucket window:** sum the last `ADAPT_WINDOW = 3` finished waves to pick the dominant type. Three waves smooths out single-wave noise from a boss splash spike, short enough that swapping a tower mid-run actually retunes the herd within ~2 waves.
- **Tie-break:** lexical on `DamageType` keys, deterministic so replays don't drift.
- **Source attribution:** all five damage paths already funnel through `applyDamage` with a `DamageType`. Add a one-liner there: `world.adaptation.perWave.get(world.wave)![type] += dealt`. No need to thread anything else.

`dominantNext` is computed at the start of wave N≥12 and held constant for the duration of that wave. Spawned enemies snapshot it at spawn time — no live re-tuning mid-wave, which would feel arbitrary to the player.

---

## Resistance application

Per-spawn, mutate the enemy's `extraResists[dominantNext]` field (already exists, used by the resist-chip path at `src/sim/world.ts:1121`). This piggybacks on the existing multiplier pipeline so no new branch is needed in `applyDamage`.

```
extraResists[type] = max(0, 1 − adaptiveBoost(level) × roll)
```

| Level | `adaptiveBoost` | Coverage (fraction of spawns adapted) |
| ----- | --------------- | ------------------------------------- |
| 12    | 0.20            | 0.30                                  |
| 14    | 0.26            | 0.45                                  |
| 16    | 0.32            | 0.60                                  |
| 18    | 0.40            | 0.75                                  |
| 20    | 0.50            | 0.90                                  |
| 22    | 0.60            | 1.00                                  |
| 26+   | 0.75            | 1.00                                  |

- **Effective multiplier:** stacks multiplicatively with the kind's base `ENEMY_RESIST`. A stego (base flame 0.6) at L20 with full coverage hits `0.6 × (1 − 0.50) = 0.30` effective flame mul. At L26+ the same stego is `0.6 × 0.25 = 0.15` — nearly immune.
- **Hard immunity:** if `base × (1 − boost) ≤ 0.10`, snap to 0. Sells "this enemy is _immune_ to your build" rather than "you ping for 6% damage." Triggers naturally for any kind whose base resist is already <0.4 by L22+.
- **Bosses:** apply boost at half rate (`boost × 0.5`) and never snap to 0. Matriarchs already have scripted hard-counter resists per `BOSS_VARIANT_RESIST`; adaptation should _tilt_ that fight, not eliminate the player's window.
- **Roll:** `Math.random() < coverage` per spawn decides whether the enemy adapts. The dice roll lives in the spawn path, not in `applyDamage`, so deterministic replay needs the spawn-time RNG seed (no new seed needed — reuse existing wave RNG).
- **Pulse T3 (Annihilator) interaction:** the existing `armorPierce` clamp at `src/sim/world.ts:1122` already neutralizes `extraResists < 1` for kinetic. Adaptive kinetic resistance is therefore explicitly counterable by Pulse T3 — _intended_, makes T3 feel load-bearing in late game.
- **Chain T3 (Arc Furnace) interaction:** `resistStrip` at `src/sim/world.ts:1141` already pulls `extraResists[type]` toward 1 per hit. So Chain T3 chip-cracks adaptive resistance mid-wave — also intended.

---

## Visual tint

Mapping: **enemies resistant to type X carry a tint hinting at X**, drawn from the existing `DAMAGE_TYPE_COLOR` palette (`src/sim/world.ts:778`). Same palette the UI already uses for damage-type pips, so the player learns the mapping in one place.

| Resisted type | Tint hex   | Read                                         |
| ------------- | ---------- | -------------------------------------------- |
| kinetic       | `#c9cbd1`  | gunmetal grey — armored, bullet-glanced       |
| electric      | `#c48cff`  | violet — arcing/charged hide                  |
| cold          | `#aaf0ff`  | pale cyan — frost-laminated, ice-shrugging    |
| explosive     | `#ffb266`  | amber — scorched, blast-hardened plate        |
| flame         | `#ff5a3a`  | crimson — heat-bled, char-resistant           |

Slot a fourth branch into `ModelEnemyMesh.tsx:422` `apply()`, priority below frost+matriarch but above elite:

```ts
if (frost > 0.01) /* existing */;
else if (matriarch && matriarchMaterial) /* existing */;
else if (adaptiveType) {
  mm.color.copy(base).lerp(adaptiveTint, adaptiveTintAmount);
}
else if (elite) /* existing */;
else mm.color.copy(base);
```

Tint amount scales with level so later mutations read as more visually pronounced:

| Level   | `adaptiveTintAmount` |
| ------- | -------------------- |
| 12–14   | 0.10                 |
| 15–17   | 0.18                 |
| 18–20   | 0.28                 |
| 21–25   | 0.38                 |
| 26+     | 0.48                 |

Stays below `ELITE_TINT_AMOUNT` (≈0.55 based on the existing code) at every level, so an adapted-but-not-elite enemy never out-saturates an elite — keeps the elite chip's silhouette dominant.

**Elite + adapted stacking:** elite branch wins (its tint is more important to read for HP/threat assessment). Adaptation read still telegraphs because the elite's per-kind tint usually clashes with the adaptive palette — designer can revisit if real playtests show confusion.

**Emissive:** no adaptive emissive. Keep emissive reserved for frost / matriarch / elite to avoid every enemy in L25+ being a disco. Tint-only is enough signal at the scales tested.

---

## Data shape additions

`src/sim/types.ts`:

```ts
// On Enemy
adaptiveResistType?: DamageType;     // snapshotted at spawn; undefined = not adapted
adaptiveResistAmount?: number;       // for renderer tint lerp (0..1)
```

`src/sim/world.ts`:

```ts
// Constants
export const ADAPT_TRIGGER_LEVEL = 12;
export const ADAPT_WINDOW = 3;
export const ADAPT_BOOST_BY_LEVEL: (level: number) => number;
export const ADAPT_COVERAGE_BY_LEVEL: (level: number) => number;
export const ADAPT_TINT_AMOUNT_BY_LEVEL: (level: number) => number;
export const ADAPT_TINT_BY_TYPE: Record<DamageType, string>;
export const ADAPT_BOSS_BOOST_SCALE = 0.5;
export const ADAPT_IMMUNITY_FLOOR = 0.10;
```

---

## Open questions (defer until implementation)

- Should the briefing/SITREP UI surface the dominant type the herd is currently adapting to? (Probably yes, as a one-line addendum on the L12+ briefing screen — but out of scope for this spec.)
- Telemetry: do we want to log adaptation churn (how often dominant flips wave-to-wave) for balance tuning? Cheap to add later.
- Tutorial pop on first adapted spawn? Defer — the SITREP at L11 already primes it.
