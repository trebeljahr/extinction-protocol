# Robot Kit Rework — Distinct Identities + In-Game Explanations

Playtest 10 / item 6. Robots feel samey: same dash → burst → buff → ult template, similar VFX, no in-game description of what abilities do. Goal: lock each robot to one combat fantasy (sniper / electric / flame / explosive), make their basic attack + 4 abilities mechanically distinct, and surface a full ability tooltip card for every slot in the shop and HUD.

## Identity Assignment

| Robot  | Fantasy           | Element     | Range Band     | Fire Cadence | Basic Attack |
|-------|-------------------|-------------|----------------|--------------|--------------|
| George| Sniper            | kinetic     | longest (10.5) | very slow    | piercing tracer-beam, single-target, high-damage |
| Leela | Electric skirmisher| electric   | mid (5.5)      | very fast    | hitscan zap that chains to 1 nearby on every shot |
| Mike  | Flame brawler     | flame       | short (5.5)    | fast splash  | splash + burn DoT on every hit (3s, 18 dmg total) |
| Stan  | Explosive artillery| explosive  | long (9.0)     | slow         | every shell detonates; impact creates a lingering crater |

Stat re-tuning (variant baseline, skill ranks layer as today):

```
                  hp   spd  range  dmg  fireRate  splashR  type
George (sniper)   200  4.0  10.5   42   0.8       0        kinetic
Leela  (chain)    170  6.0  5.5    9    4.5       0        electric
Mike   (flame)    210  4.2  5.5    9    4.5       0.8      flame
Stan   (artillery)290  3.3  9.0    34   1.0       1.5      explosive
```

George loses being "the balanced one" and becomes a real sniper. Stan stays artillery (long range + AoE per shot) but is no longer out-ranged by anyone — sniper > artillery > electric ≈ flame.

## Kit Layout (QWER unchanged: slot 0/1/2/3 = dash / burst / buff / ultimate)

### George — Vanguard (kinetic sniper)
- **Q · Sidestep** — *short lateral hop with i-frames; next shot is an auto-crit (×2.5 dmg, piercing).* (`dash` + flag the next auto-attack as crit)
- **W · Pierce Shot** — *fires a 12-unit kinetic lance in front of him; passes through every enemy in a 0.6-wide rectangle, 90 dmg each.* (new payload `pierce`)
- **E · Spotter Drone** — *buff: +60% range, +60% damage, ×0.6 fire rate, ×0.5 move speed for 5s. Scope-in stance.* (existing `buff`)
- **R · Killshot** — *locks the highest-progress enemy within 14 units, charges 1.2s, deletes it with a hitscan tracer + 200 splash damage at the impact point.* (new payload `killshot`)

### Leela — Strider (electric)
- **Q · Phase Step** — *forward dash, i-frames; arc of chain lightning hits 3 closest dinos on dash end (24 dmg each).* (`dash`, on-end chain emit)
- **W · Tesla Pulse** — *radial discharge at robot (70 dmg) that then chains via beam to 4 additional targets in 6-unit radius (35 dmg per hop, electric).* (existing `burst` + new `chainHops` field)
- **E · Phase Veil** — *buff: +70% speed, +60% fire rate, +15% damage, 80% resist for 3s; same window also tags every hit as chain.* (existing `buff`)
- **R · Overcharge** — *marks up to 5 nearby enemies for 5s; ongoing chain-lightning arc tags every marked enemy every 0.5s for 22 dmg each (additive on mark).* (re-thematise `mark` as multi-target arc + add tick damage field)

### Mike — Pyre (flame)
- **Q · Thruster Burst** — *aimed forward dash with i-frames; drops a coal trail that burns for 2.6s (existing). Trail tick damage 22.* (existing `dash`, retain aim mode)
- **W · Flame Nova** — *radial flame burst at robot (95 dmg) + applies a 4s burn DoT (40 total) to every enemy hit.* (existing `burst` + new `burnDuration`/`burnTotal` fields)
- **E · Ignition** — *buff: ×2 fire rate, +30% damage, light plating (35% resist) for 4s. While active, every auto-attack applies a 2s burn DoT (12 total).* (existing `buff` + new `igniteOnHit` flag)
- **R · Incinerate** — *locks nearest mid-range enemy, sustained flame cone with ground fire that ticks 64 dmg/s for 4.5s; cone width 2.5, range 8.* (existing `incinerate`, expanded visual — keep math, change VFX)

### Stan — Mauler (explosive)
- **Q · Ground Pound** — *short dash with i-frames; on landing detonates a 3.5-radius explosion at his feet (110 explosive dmg).* (`dash` + new `landingBlast` field)
- **W · Quake** — *radial explosive burst (160 dmg) + applies a 0.6s knockback (–2 units lateral progress) to every dino hit.* (existing `burst` + new `knockback` field)
- **E · Bulwark** — *buff: roots him (×0.5 speed), +40% damage, 75% resist for 5s. Existing — left as-is.*
- **R · Saturation Strike** — *10-shell barrage over 9s area (existing) + every shell leaves a 2-unit crater that ticks 18 explosive dmg/s for 3s.* (existing `barrage` + new `craterDuration`/`craterTick` fields)

## Distinct Visuals

Robot-specific VFX layered on the existing `spawnParticles` / `createBeam` / `createExplosion` / `createCryoWave` / `createCoalEmber` primitives — no new render systems needed.

| Robot  | Auto-attack VFX                                    | Burst VFX                              | Ultimate VFX                                |
|-------|----------------------------------------------------|----------------------------------------|---------------------------------------------|
| George| thin white tracer-beam to target, faint sparks at muzzle | none yet (Q/W changed)            | long charged beam + impact explosion        |
| Leela | electric-blue zap beam, sparks at hit + chain hop  | radial beams to each hop                | persistent arcing beams between marked dinos |
| Mike  | splash flame + orange ember puff at impact         | wide orange/red ring + smoke           | flame-cone ground fire + heat shimmer       |
| Stan  | explosive splash + dust kick + screen shake (small)| big orange-red shockwave + dust ring   | shell streaks from off-screen + craters     |

Tints stay (George #9fd8ff, Leela #5ad6ff, Mike #ff8a3a, Stan #ffd24a). Burst particle color also keys off variant tint instead of the current hard-coded "#ff8a3a" so an electric burst no longer reads as flame.

## Schema Changes (`robotVariants.ts` + `types.ts`)

Existing variants stay compatible; add optional fields:

```ts
type DashSpec = {
  type: "dash";
  cooldown: number;
  duration: number;
  speed: number;
  // George: next auto-attack lands as crit (×mul, piercing tracer).
  nextShotCrit?: { mul: number; pierce: boolean };
  // Leela: chain-lightning emit on dash-end. count + dmg per hop.
  endChain?: { hops: number; damagePerHop: number; radius: number };
  // Stan: explosion at landing position.
  landingBlast?: { radius: number; damage: number };
};

type BurstSpec = {
  type: "burst";
  cooldown: number;
  radius: number;
  damage: number;
  damageType: DamageType;
  // Leela: forks to N more enemies via beam after the initial blast.
  chainHops?: { hops: number; damagePerHop: number; radius: number };
  // Mike: applies burn DoT to every enemy hit.
  burn?: { duration: number; totalDamage: number };
  // Stan: lateral knockback applied to every enemy hit.
  knockback?: { duration: number; lateralPush: number };
};

type BuffSpec = {
  type: "buff";
  cooldown: number;
  duration: number;
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  damageResist: number;
  // George: also multiplies robot.range while active.
  rangeMul?: number;
  // Mike: every auto-attack applies a short burn DoT while buff active.
  igniteOnHit?: { duration: number; totalDamage: number };
};

type PayloadSpec =
  | { type: "barrage"; ...; crater?: { duration: number; tickDamage: number; radius: number; tickInterval: number } }
  | { type: "mark"; ...; arcTick?: { interval: number; damage: number; radius: number } }
  | { type: "incinerate"; ... }            // unchanged
  | { type: "pierce"; cooldown; range; width; damage; damageType }       // George W
  | { type: "killshot"; cooldown; range; chargeTime; damage; splashDamage; splashRadius; damageType };  // George R
```

Auto-attack chain-on-hit for Leela goes on the variant (not the ability): new optional `attackChain?: { hops: number; damageMul: number; radius: number }` on `RobotVariantSpec`. `fireRobotShot` reads it.

Burn DoT needs a new per-enemy effect store (`enemy.burns: { endAt, nextTickAt, tickDamage, damageType }[]`) ticked once per sim step in `world.ts`. Knockback re-uses the existing `enemy.segmentT` lateral system (or just nudges `segmentT` backwards by N units).

## Ability Tooltip / Shop UI

Current bugs in `src/ui/RobotShop.tsx`:
- `AbilityCard` only maps `[0, 1, 2]` — slot 3 (ultimate) never renders. Fix: map `[0, 1, 2, 3]` and widen `formatAbilityStats`'s `slot` type.
- `formatAbilityStats` `buff` branch is fine, but the new payload variants (`pierce`, `killshot`, `chainHops`/`crater`/`arcTick` modifiers) need formatter cases.
- `ABILITY_BLURB` is keyed by `a.type` — too generic, every robot's `burst` shares one line. Replace with per-robot per-slot blurbs sourced from `RobotVariantSpec.abilityBlurbs: [string, string, string, string]` so each card explains what *this* robot's W does.
- Add a 5th "Auto-Attack" card above the QWER list (collapsed by default) describing basic-attack damage, range, fire rate, damage type, and the per-robot on-hit rider (chain / burn / splash crater).

Same blurb data also feeds `src/ui/RobotSelectionPanel.tsx` as tooltips on the QWER glyph icons in the live HUD — first-time players see what each key does on hover.

## Implementation Order

1. **Schema + data** — extend ability spec union; update `ROBOT_SPECS` to new identities; add `abilityBlurbs` per robot. Compile clean.
2. **Burn-DoT effect** — `enemy.burns[]`, tick in `world.ts`; reuse `applyDamage` so resists/shields still work.
3. **Knockback** — single helper that pushes `segmentT` backwards N units (clamped to segment), called from Quake.
4. **Sim wiring** — `fireRobotShot` reads `attackChain`; `triggerRobotAbility` adds `pierce` / `killshot` branches and applies new optional fields (`endChain`, `landingBlast`, `chainHops`, `burn`, `knockback`, `crater`, `arcTick`, `nextShotCrit`, `igniteOnHit`, `rangeMul`).
5. **VFX swap** — burst particles read `variant.tint`; George auto-shot draws tracer beam; Leela hit spawns chain-hop beams; Stan auto-shot adds dust + small shake; Mike auto-shot adds ember puff.
6. **UI** — `formatAbilityStats` handles new types; `AbilityCard` maps all 4 slots + an Auto-Attack card; per-robot `abilityBlurbs`; HUD tooltip on QWER glyphs.
7. **Smoke-test** — load each robot, fire every ability on a dummy wave, confirm cooldowns, damage types in floating text, and that the shop renders all 5 cards (auto + QWER).

## Scope Cut (defer if needed)

- Spotter Drone could spawn an actual flying drone mesh — defer, just use a small particle halo on George.
- Killshot's pre-fire windup could use a unique sound — out of scope, no audio system touched.
- Knockback animation curve — start with instant segmentT push; smooth lerp later if it reads bad.
- Re-baking robot GLB skeletons for new pose variants — not in scope; reuse existing shoot/dash anims.
