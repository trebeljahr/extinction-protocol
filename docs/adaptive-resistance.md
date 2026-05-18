# Adaptive Resistance

Playtest note 10, item 14. Builds on item 13 (static per-type resists already shipped at `ENEMY_RESIST` in `src/sim/world.ts:790`).

The herd should _actually_ adapt to the damage type the player is leaning on, telegraphed visually by an off-color tint that intensifies in later levels.

---

## Narrative anchor

`LEVEL_INTERSTITIAL[11]` (`src/levels/briefings.ts:95`) is the command update that names the adaptation loop: _"every kill seeds the next wave, because the conditioning network selects against the round that killed the last one. We have been training the herd."_

Adaptation behavior turns on **starting L12** — the level after the announcement, so the command update is paid off mechanically on the very next wave.

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

Per-spawn, mutate the enemy's `extraResists[dominantNext]` field (already exists, used by the resist-chip path). This piggybacks on the existing multiplier pipeline so no new branch is needed in `applyDamage`.

```
extraResists[type] = existing × (1 − adaptiveBoost(level, streak, share) × bossScale)
```

The boost composes three independent terms so a parked-on-one-tower player is punished much faster than a diversified one at the same level:

```
levelTerm  = 0.05 + (level − 12) × 0.015
streakTerm = min(0.2, max(0, streak − 1) × 0.04)
concTerm   = max(0, share − 0.5) × 0.3
boost      = min(0.7, levelTerm + streakTerm + concTerm)
```

Coefficients were dialed down from a 0.95 cap (playtest 13: "scales too hard, punishes towers so early waves become impossible"). Half the per-term contribution and a 0.7 ceiling keep adaptation a meaningful tilt without hard-walling early-game towers.

- `streak` = consecutive waves the dominant damage type has stayed the same. Updated in `startWave` from the previous wave's dominant, reset to 1 on a type flip and to 0 when there's no recorded damage.
- `share` = dominant type's fraction of the trailing `ADAPT_WINDOW` damage total. Below the 0.5 concentration floor it contributes nothing — adaptation still applies, but the herd doesn't ramp into immunity.

Sample boost across player behavior (no boss scale):

| Level | Streak | Share | `boost` | Read                                              |
| ----- | ------ | ----- | ------- | ------------------------------------------------- |
| 12    | 1      | 0.50  | 0.05    | Just unlocked; herd barely flinches.              |
| 12    | 4      | 0.90  | 0.29    | One tower since L8; herd has tuned.               |
| 18    | 6      | 0.90  | 0.50    | Single-tower into late-game — meaningful tilt.    |
| 20    | 1      | 0.40  | 0.17    | Diversified; light resist on adapted spawns.      |
| 20    | 8      | 0.95  | 0.62    | Refused to swap — most adapted spawns highly resistant. |

Coverage (per-spawn probability of being one of the adapted variants) uses the same three-term shape:

```
base       = 0.10 + (level − 12) × 0.03
streakBon  = min(0.25, max(0, streak − 1) × 0.04)
concBon    = max(0, share − 0.5) × 0.3
coverage   = min(0.7, base + streakBon + concBon)
```

A diversified player at L20 sees ~0.34 coverage; a single-tower player at L20 hits the 0.7 cap with the boost stacked too — so ~30% of every wave still arrives unadapted, leaving a counter-play window.

- **Effective multiplier:** stacks multiplicatively with the kind's base `ENEMY_RESIST`. A stego (base flame 0.6) at L18 against a streak-6, share-0.9 player hits `0.6 × (1 − 0.86) = 0.084` — below the immunity floor, snaps to 0.
- **Hard immunity:** if `base × (1 − boost) ≤ 0.10`, snap to 0. Sells "this enemy is _immune_ to your build" rather than "you ping for 6% damage." Triggers much earlier now that streak/concentration stack into the boost.
- **Bosses:** apply boost at half rate (`boost × 0.5`) and never snap to 0. Matriarchs already have scripted hard-counter resists per `BOSS_VARIANT_RESIST`; adaptation should _tilt_ that fight, not eliminate the player's window.
- **Roll:** `Math.random() < coverage` per spawn decides whether the enemy adapts.
- **Pulse T3 (Annihilator) interaction:** the existing `armorPierce` clamp already neutralizes `extraResists < 1` for kinetic. Adaptive kinetic resistance is therefore explicitly counterable by Pulse T3 — _intended_, makes T3 feel load-bearing in late game.
- **Chain T3 (Arc Furnace) interaction:** `resistStrip` already pulls `extraResists[type]` toward 1 per hit. So Chain T3 chip-cracks adaptive resistance mid-wave — also intended.

---

## Visual tint

Mapping: **enemies resistant to type X carry a tint hinting at X**. Decoupled from `DAMAGE_TYPE_COLOR` (which is tuned for pale-on-dark UI text and washes out on textured dino bodies) — the body palette below uses the same hues bumped to higher saturation / lower luminance so the off-color tint stays legible across all five types.

| Resisted type | Tint hex   | Emissive hex | Read                                          |
| ------------- | ---------- | ------------ | --------------------------------------------- |
| kinetic       | `#5a6478`  | `#2a2f3a`    | gunmetal slate — bullet-glanced steel         |
| electric      | `#a040ff`  | `#6a18cf`    | saturated violet — arc-charged hide           |
| cold          | `#3ec0ff`  | `#1880c0`    | deep ice blue — frost-laminated               |
| explosive     | `#ff8a1f`  | `#a04408`    | burnt orange — blast-hardened plate           |
| flame         | `#ff2a14`  | `#b01408`    | hot crimson — char-resistant                  |

The `Adapted` badge in `EnemyPanel` also pulls from this palette so badge hue matches the dino's body tint instead of a fixed amber.

`ModelEnemyMesh.tsx`'s `apply()` branches in priority order (frost > matriarch > adapted):

```ts
if (frost > 0.01) /* existing */;
else if (matriarch && matriarchMaterial) /* existing */;
else if (adaptiveTint && adaptiveAmount > 0) {
  mm.color.copy(base).lerp(adaptiveTint, adaptiveAmount);
}
else mm.color.copy(base);
```

Tint amount scales with level base AND streak — a player who refuses to swap towers watches the herd's hide deepen wave over wave:

```
base = 0.15 / 0.22 / 0.30 / 0.40 / 0.50  // level bands: 12-14 / 15-17 / 18-20 / 21-25 / 26+
streakBon = min(0.15, max(0, streak − 1) × 0.03)
adaptiveTintAmount = min(0.65, base + streakBon)
```

The streak bump is intended for long single-tower runs: at that point the player has earned the strong "this dino is hard-immune to your build" read.

**Emissive:** adapted enemies get a small inner glow from `ADAPTIVE_EMISSIVE_BY_TYPE`, multiplied by `adaptiveAmount * 0.6`. Only fires when no higher-priority emissive (flash/frost/matriarch) is active, and stays subtle so L25+ doesn't turn into a disco.

---

## Data shape additions

`src/sim/types.ts`:

```ts
// On Enemy
adaptiveResistType?: DamageType;     // snapshotted at spawn; undefined = not adapted
adaptiveResistAmount?: number;       // for renderer tint lerp (0..1)
```

`src/sim/types.ts` — AdaptiveResistanceState carries the streak and concentration share so they survive across waves:

```ts
type AdaptiveResistanceState = {
  perWave: Map<number, Record<DamageType, number>>;
  dominantNext: DamageType | null;
  dominantStreak: number;     // consecutive waves dominant has stayed same
  dominantShare: number;      // share 0..1 of dominantNext in window
};
```

`src/sim/world.ts`:

```ts
// Constants
export const ADAPT_TRIGGER_LEVEL = 12;
export const ADAPT_WINDOW = 3;
export const ADAPT_BOSS_BOOST_SCALE = 0.5;
export const ADAPT_IMMUNITY_FLOOR = 0.10;
export const ADAPT_CONCENTRATION_FLOOR = 0.5;
export const adaptiveBoost: (level: number, streak: number, share: number) => number;
export const adaptiveCoverage: (level: number, streak: number, share: number) => number;
export const adaptiveTintAmount: (level: number, streak: number) => number;
export const ADAPTIVE_TINT_BY_TYPE: Record<DamageType, string>;      // body lerp
export const ADAPTIVE_EMISSIVE_BY_TYPE: Record<DamageType, string>;  // inner glow

// computeAdaptiveDominant now returns share alongside the picked type
// so startWave can stash it on the world for spawnEnemy to read.
export const computeAdaptiveDominant: (world: World) => {
  type: DamageType | null;
  share: number;
};
```

---

## Open questions (defer until implementation)

- Should the briefing/command-update UI surface the dominant type the herd is currently adapting to? (Probably yes, as a one-line addendum on the L12+ briefing screen — but out of scope for this spec.)
- Telemetry: do we want to log adaptation churn (how often dominant flips wave-to-wave) for balance tuning? Cheap to add later.
- Tutorial pop on first adapted spawn? Defer — the command update at L11 already primes it.
