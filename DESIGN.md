# Mesozoic Protocol — Design Document

> **Name locked.** Mesozoic Protocol — clean on Steam / iOS / Google Play / domain at decision time. Old working title was "Extinction Protocol" (Steam slot held by Drawblack app 1078210 since 2019). Single-player roguelite tower defense. Top-down, 3D models under orthographic camera. Sci-fi turrets defend a collapsing research outpost against waves of reanimated prehistoric fauna and rogue bio-mech.

---

## 1. Elevator Pitch

You are the last automation engineer at Outpost Kairos, a fossil-reclamation lab where something went very wrong. Build turret chains, harvest fallen bio-matter, and survive escalating waves of velociraptors, mech-dinos, and armored saurs across procedurally-assembled sectors. Every run ends in extinction — yours or theirs.

One-sentence pitch: **"Bloons meets Rogue Tower, with dinosaurs."**

## 2. Design Pillars

1. **Readable at a glance.** Top-down ortho camera. Threat, range, gold, lives — all obvious in 200ms.
2. **Build orders, not busywork.** Towers have deep synergies; the interesting choice is which combo to pursue, not how to click faster.
3. **Every run teaches something.** Meta-progression unlocks new towers and commanders, but every wipe reveals new routes through the upgrade tree.
4. **Short enough to finish on a lunch break.** Run length 20–35 min. Replays, not grinds.
5. **The assets carry the mood.** Prehistoric silhouettes + stark sci-fi turrets = immediate visual contrast. No art-style drift.

## 3. Core Loop

```
┌─────────────────────────────────────────────────────┐
│  Run start  →  pick commander + starting tower      │
│       ↓                                             │
│  Wave phase  →  enemies walk the path               │
│       ↓                                             │
│  Build phase →  place/upgrade towers, pick perk     │
│       ↓                                             │
│  Boss wave   →  every 5 waves                       │
│       ↓                                             │
│  Run end     →  win (20 waves cleared) or die       │
│       ↓                                             │
│  Meta pass   →  spend essence on permanent unlocks  │
└─────────────────────────────────────────────────────┘
```

Between waves: short build phase (default 15s, skippable). During waves: real-time, pause allowed.

## 4. The Hook

Three things, together, differentiate this from the 200 other TDs on Steam:

1. **The enemy aesthetic.** Dinosaurs are underused in TD. Your asset library already has Allosaurus, Spinosaurobot, Stegoknight, MechQuadruped, Velocirobot. Two-second trailer pitch.
2. **Tower DNA system.** Every tower has 3 upgrade branches; clearing a wave lets you *splice* a trait from one tower into another ("this laser now chains", "this cannon now freezes"). 8 base towers + splice = hundreds of builds.
3. **Sector collapse.** Maps aren't static. Every 5 waves a sector of the map collapses — towers there are destroyed, the path reroutes. Forces you to re-plan, not just stack in a corner.

## 5. Gameplay Systems

### 5.1 Towers (MVP set: 8)

| Tower          | Role       | Archetype    | Example splice trait |
|----------------|------------|--------------|----------------------|
| Pulse Rifle    | Single DPS | Projectile   | Armor shred          |
| Chain Coil     | AoE        | Electric     | Chain bounce         |
| Cryo Emitter   | Slow       | Field        | Freeze on crit       |
| Mortar         | Burst AoE  | Arc ballistic| Splash + burn        |
| Flame Nozzle   | DoT        | Cone         | Panic enemies        |
| Laser Lattice  | Pierce     | Beam         | +dmg per second held |
| Drone Bay      | Autonomous | Mobile       | Repair adjacent      |
| Gravity Well   | Control    | Field        | Pulls to center      |

Each tower: 3 upgrade branches, exclusive-or (pick one, lock the others). Upgrades cost gold during a run.

### 5.2 Enemies (MVP set: 15 = 5 base × 3 tiers)

Base types, mapped to existing GLBs:
- **Raptor** (fast, low HP) — velociraptors from enemies pack / fast dino GLBs
- **Allosaur** (standard) — `Armored Allosaurus.glb`
- **Stego** (armored, slow) — `Stegoknight.glb`
- **Spino-Mech** (regenerating boss) — `Spinosaurobot.glb`
- **Swarm** (tiny, many) — small dino assets tiled

Tiers multiply HP / speed / bounty. Bosses (every 5 waves) are oversized variants with unique abilities.

### 5.3 Economy

- Start each run with 150 gold + commander starting tower.
- Kills give bounty; wave completion gives a flat bonus.
- **Lives**: 20. Each leaked enemy costs 1 life (bosses cost more).
- **Essence** (meta currency): earned by completing waves, persists across runs, spent on permanent unlocks.

### 5.4 Commanders (MVP set: 3)

Think Slay the Spire characters. Each has a starting tower, a passive, and a unique splice trait pool.

1. **Engineer** — starts with Pulse Rifle; +10% fire rate globally.
2. **Cryo-Mancer** — starts with Cryo Emitter; slows last 1s longer.
3. **Ordnance** — starts with Mortar; all AoE +15% radius.

### 5.5 Roguelite Meta

Per-run:
- After every wave, pick 1 of 3 perks (tower discount, splice option, economy boost, defensive wall, etc.).
- Every 5 waves, a boss drop = a rare splice trait.

Persistent (between runs):
- Essence unlocks new towers, new commanders, new starting perks.
- "Research tree" with ~30 nodes for v1.0; ~10 for MVP launch.
- No power creep — meta unlocks add variety, not raw strength. (Learned the hard way by many roguelites.)

### 5.6 Maps (MVP set: 5)

Each map is a hand-designed base layout + procedural path variant on run start. Sector collapse events are pre-authored per map.

- **Outpost Kairos** (tutorial, gentle curves)
- **The Fossil Beds** (forks — path splits)
- **Reactor Rim** (hazard zones that damage enemies but destroy your towers)
- **Sunken Preserve** (water gates, amphibious enemies)
- **The Primordial Line** (endgame, long path, high enemy density)

## 6. Art Direction

- **Camera**: fixed orthographic, top-down, slight tilt (~70° from horizontal). Desktop can orbit with right-drag; mobile touch stays pan + pinch zoom only.
- **Mobile camera alternatives considered**: explicit rotate/tilt button mode, edge-hold rotate handles, or temporary two-finger orbit behind a visible modifier. Avoid implicit twist/tilt gestures until one feels intentional.
- **Palette**: cold teals and steel for player side, bioluminescent organics for enemies. High contrast between.
- **VFX budget**: screenshake on big hits, hit-flash on enemies, muzzle flashes for towers, dust puffs for deaths. No particles that obscure readability.
- **Scale**: 1 world unit = 1 meter. Tile grid = 2m. Map ~40×30 tiles.

Asset reuse plan: everything draws from `../3d-assets/`:
- Towers: `Scifi Turrets-glb`, `Ultimate Guns Pack-glb`, `wands.glb`
- Enemies: `enemies/`, dinosaur GLBs, mech GLBs
- Terrain tiles: `Hex Kit.glb`, `Platform Kit Revamped-glb`, `Stylized Nature MegaKit-glb`
- Environment textures from `textures/` (PBR-ready)

**Asset state**: 33 GLBs in `../3d-assets/` are real binary files (the rest — including most named dino/turret GLBs — are git-lfs pointers that haven't been pulled). Of the real ones, we currently use:
- `star_wars_at-st.glb` → copied to `public/models/walker.glb` (allosaur enemy)
- `star_wars_x-wing.glb` → copied to `public/models/flyer.glb` (swarm enemy)

Remaining primitives: raptor (cone), stego (dodecahedron), all four tower kinds. To swap in more real assets:
1. Copy desired `.glb` into `public/models/`.
2. Add a `<ModelEnemyMesh>` or `<ModelTowerMesh>` in `render/Scene.tsx`.
3. The `render/ModelEnemyMesh.tsx` component handles scene cloning, scale normalization, and hit-flash / slow tints.
4. For the full dino lineup, either (a) initialize `../3d-assets/` as a git repo against the original LFS remote and `git lfs pull`, or (b) download the originals separately.

## 7. Sound Direction

Your sorted folders map cleanly:
- `sounds/combat/` → tower firing, impacts
- `sounds/ambience/` → map ambient beds
- `sounds/music/` → wave music, boss music, menu
- `sounds/positives/` → wave cleared, perk pick, upgrade
- `sounds/negatives/` → life lost, boss approach, game over
- `sounds/animals/` → enemy calls

Mix priority: combat feedback > music > ambience. Ducking when multiple towers fire.

## 8. Technical Architecture

### 8.1 Stack

- **Rendering**: React Three Fiber with orthographic camera. 3D assets under top-down view.
- **Simulation**: plain TypeScript, headless, deterministic, runs at fixed 60 Hz tick rate.
- **State**: Zustand. Mutable world object held in a ref; React reads via selector hooks or direct refs in `useFrame`.
- **Build**: Vite.
- **Desktop shell**: Tauri v2 (smaller binary, native-feeling, Rust-based). Electron is a fallback if Steamworks integration proves easier there.
- **Steamworks**: `tauri-plugin-steamworks` or shell out via IPC. Implement late (M8).
- **Persistence**: JSON save file in Tauri app-data dir. No cloud for v1.

### 8.2 Sim / Render Separation

**Critical rule:** simulation never touches Three.js. Render layer never mutates sim state.

```
┌─────────────────┐      ┌─────────────────┐
│   Sim (TS)      │─────▶│   Render (R3F)  │
│  fixed 60 Hz    │ read │  display 60–144 │
│  deterministic  │      │  interpolated   │
└─────────────────┘      └─────────────────┘
```

Benefits: deterministic replays, headless testing, easier Steam achievements (hook sim events), pause works correctly, variable framerate doesn't affect gameplay.

### 8.3 Fixed Timestep Loop

Classic accumulator pattern. Sim advances in fixed 16.67ms ticks regardless of render rate. Render reads latest sim state each frame; optionally interpolates between the last two tick snapshots.

### 8.4 Data Model Summary

- `World` holds all mutable run state: enemies, towers, projectiles, path, gold, lives, wave number, time.
- Entities use integer IDs; arrays of structs. No ECS for MVP (overkill for ~200 entities max).
- Path is a polyline; enemies carry `(segmentIndex, segmentT)` along it.

### 8.5 Save System

- Run state: serializable snapshot. Save at wave boundaries.
- Meta state: separate file, atomic writes (write-temp + rename).
- Versioned schema from day 1 — migrations cheaper than regretting no-schema.

## 9. Content Targets

### MVP (M6, Early Access)
- 8 towers × 3 branches = 24 upgrade paths
- 15 enemy types (5 base × 3 tiers) + 4 bosses
- 3 commanders
- 5 maps
- 30 runs of content before meta-tree is exhausted

### v1.0 (M9+)
- 12 towers
- 25 enemy types + 8 bosses
- 6 commanders
- 8 maps
- Endless mode
- Daily challenge seed

## 10. Roadmap

| Month | Focus | Status | Deliverable |
|-------|-------|--------|-------------|
| M1    | Tech spine | ✅ done | Sim loop, path, 1 tower, 1 enemy, projectiles, ortho scene, HUD. Playable solo. |
| M2    | Game feel + content pass 1 | ✅ done | 4 towers (pulse/chain/cryo/mortar), 4 enemies (+ swarm), upgrade tree (2 branches × 3 tiers), audio wired, hit feedback + screenshake. |
| M3    | Roguelite meta + Steam page | — | Per-run perks, meta tree skeleton, 3 maps, 2 commanders. **Steam page live.** |
| M4    | Splice system + content pass 2 | — | Tower DNA, 8 towers, bosses, sector collapse events, 5 maps. |
| M5    | Balance + closed beta | — | Steam playtest, telemetry, balance passes. Marketing gif cadence. |
| M6    | Polish + trailer + EA launch | — | Launch trailer, UI pass, accessibility, Early Access on Steam. |

Post-EA (M7–M9): content, mod support, endless mode, v1.0.

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| R3F performance with 200+ entities | Medium | Instanced meshes from M1; swap to raw Three.js if instancing insufficient |
| Tauri + Steamworks integration friction | Medium | Prototype in M3; fallback to Electron if blocking |
| Art cohesion (mixed asset sources) | High | Strict palette rules + post-processing (color grade, outline, fog) to unify |
| Balance of 8 towers × 3 branches | High | Save 2 weeks of M5 purely for balance; external playtesters from M3 |
| Discoverability on Steam | High | Steam page up by M3, not M6. TikTok/YouTube gifs weekly. Demo during Next Fest. |
| Scope creep into multiplayer | Certain | It is NOT in scope. Write it down. |

## 12. Commercial Plan

- **Platform**: Steam only for v1.0. (No itch exclusivity, no mobile port until post-v1.0.)
- **Price**: $14.99 EA → $19.99 at v1.0. Roguelite TD comparables ($12.99 Rogue Tower, $24.99 Kingdom Rush, $19.99 Dome Keeper).
- **Target wishlist at launch**: 25,000 (minimum viable for Steam algorithm). Stretch: 50,000.
- **Marketing cadence**:
  - M3: Steam page live, Twitter/Bluesky/TikTok accounts up.
  - M3–M6: weekly gif/clip cadence. Target r/tower_defense, r/incrementalgames, r/roguelites.
  - M5: Steam Next Fest demo (the single biggest wishlist driver).
  - M6: launch trailer (60s, hook in first 3s).
- **Revenue expectations** (public comparables, not promises):
  - Floor: $50K–$200K lifetime.
  - Realistic: $500K–$2M if hook lands and Next Fest demo converts.
  - Upside: $5M+ if it catches fire (Rogue Tower / Dome Keeper tier).

## 13. Out of Scope (Write It Down)

- Multiplayer (co-op or competitive). Not in v1.
- Mobile port. Not in v1.
- Procedural map generation. Hand-authored + procedural *paths* only.
- Character progression beyond commander unlocks. No XP bars.
- Narrative cutscenes. Barks and environmental storytelling only.
- Workshop / mod support. Consider post v1.0 once architecture has stabilized.

## 14. Open Questions

- Grid-based tower placement, or free-form with snap? (Default: grid, 2m tiles.)
- Do towers block the path, or only sit adjacent? (Default: adjacent only, like Bloons.)
- Should the player control a robot unit too? (Default: no — pure TD keeps scope contained.)
- How much of the outpost narrative do we need? (Default: environmental + optional audio logs.)

---

**This is a living document.** Update as decisions land. The roadmap and scope lines are the ones to defend hardest.
