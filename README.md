# Mesozoic Protocol

Single-player roguelite tower defense: deploy sci-fi turrets, hold collapsing outposts, and survive waves of prehistoric and bio-mech threats in a top-down 3D battlefield.

## Current Game

- World-map campaign with 30 outposts across forest, snow, desert, wasteland, lava, and alien biomes.
- Six tower types: Pulse Rifle, Chain Coil, Pyre, Hive Swarm, Mortar, and Cryo Emitter.
- Seven enemy species with distinct speeds, health pools, rewards, damage, and resistances.
- Per-level star progress, achievements, enemy compendium, audio/music, hit feedback, screenshake, and upgrade/sell/targeting controls.
- Web build for development/deployment, a Tauri v2 desktop shell (Steam-shippable), and a Capacitor mobile shell (iOS + Android).

Long-form design notes live in [DESIGN.md](DESIGN.md). Distribution flow (Steam, App Store, Play) lives in [DISTRIBUTION.md](DISTRIBUTION.md). Keep this README focused on setup, controls, and repository orientation.

## Prerequisites

- Node.js 24+
- pnpm 10+
- Rust toolchain and Tauri prerequisites for desktop builds: <https://tauri.app/start/prerequisites/>
- For mobile builds: Xcode 15+ (iOS) and JDK 17+ + Android SDK (Android). See [DISTRIBUTION.md](DISTRIBUTION.md).

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Open <http://localhost:3286>.

For the desktop shell:

```bash
pnpm tauri dev
```

For mobile (after `pnpm build`):

```bash
npx cap sync       # sync the web bundle into ios/ and android/
npx cap open ios   # open in Xcode
npx cap open android  # open in Android Studio
```

## Build And Check

```bash
pnpm build         # type-check and build the web bundle
pnpm tauri build   # build desktop bundles (DMG, MSI, NSIS, AppImage, deb)
npx cap sync       # sync the web bundle into ios/ and android/
pnpm lint          # Biome lint
pnpm check         # Biome check with fixes
pnpm format        # format the repo
```

## Controls

World map:

- Click an unlocked outpost to deploy.
- Open the menu for sound controls, achievements, and the compendium.

Mission:

- **1-6** - pick tower kind.
- **Click valid ground** - place the selected tower.
- **Click a tower** - open targeting, upgrade, and sell controls.
- **Space** - start waves or call the next wave early.
- **P** - pause or resume.
- **Esc** - clear the current selection, close panels, or open/close the menu.
- **R** - retry from the results screen.

## Project Layout

```text
src/
  App.tsx          React app shell and top-level screen routing
  store.ts         Zustand state, actions, persistence bridge
  levels/          campaign outposts, paths, waves, and starting gold
  sim/             headless TypeScript gameplay simulation
  render/          React Three Fiber scene and model/VFX rendering
  ui/              HUD, menus, panels, compendium, results, world-map UI
  audio/           WebAudio manager and game-event audio bridge
  biomes.ts        biome styles and prop layers
  progress.ts      local progress, stars, and encounter tracking
  achievements.ts  achievement definitions and unlock checks
public/
  audio/           bundled SFX and music
  models/          bundled GLB models and environment props
scripts/           asset and wave-analysis utilities
src-tauri/         Tauri v2 desktop wrapper (Steam target)
ios/               Capacitor iOS shell (open with `npx cap open ios`)
android/           Capacitor Android shell (open with `npx cap open android`)
```

## License

Unlicensed for now. TBD before launch.
