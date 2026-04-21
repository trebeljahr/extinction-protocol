# Extinction Protocol

Single-player roguelite tower defense. Top-down 3D under orthographic camera. Built with React Three Fiber + TypeScript + Vite, wrapped with Tauri v2 for Steam.

See [DESIGN.md](DESIGN.md) for the full design document.

## Status

**M2 complete.** Four tower kinds with distinct behaviors, four enemy kinds including swarm, a 2-branch × 3-tier upgrade tree per tower, audio wired to game events, hit feedback (flash, particles, explosions, screenshake), tower selection + sell, clean game-feel pass.

## Prerequisites

- Node.js 20+
- (Optional, for desktop build) Rust toolchain + Tauri prerequisites — see <https://tauri.app/start/prerequisites/>

## Run (web)

```bash
npm install
npm run dev
```

Open <http://localhost:3286>.

## Controls

- **1–4** — pick tower kind (Pulse / Chain / Cryo / Mortar)
- **Click empty tile** — place selected tower
- **Click a tower** — open upgrade/sell panel
- **Space** — pause/resume
- **R** — restart run
- **M** — mute / unmute

## Towers

| # | Name | Role | Cost |
|---|------|------|------|
| 1 | Pulse Rifle | Single-target DPS | 50g |
| 2 | Chain Coil | Electric chain (3 bounces) | 90g |
| 3 | Cryo Emitter | AoE slow + damage pulse | 75g |
| 4 | Mortar | Slow arcing splash | 120g |

Each tower has two upgrade branches with three tiers each. Gold is earned from kills and wave completion.

## Run (desktop, Tauri)

```bash
npm install
npm run tauri dev
```

First run builds Rust dependencies; takes a few minutes. Subsequent runs are fast.

## Build

```bash
npm run build         # web bundle
npm run tauri build   # desktop (.app / .exe / .AppImage)
```

## Project layout

```
src/
  main.tsx                   entry
  App.tsx                    root component
  store.ts                   Zustand world ref, UI snapshot, actions
  level.ts                   starting level config (path, map)
  vite-env.d.ts              vite client types
  sim/                       headless simulation (no React, no Three.js)
    types.ts                 all shared types
    vec2.ts                  2D vector utilities
    path.ts                  polyline utilities
    world.ts                 world state + factories + events + shake
    loop.ts                  fixed-timestep accumulator
    spawner.ts               wave composition + lifecycle
    enemies.ts               enemy movement + slow + leak
    towers.ts                target acquisition + per-kind firing
    projectiles.ts           projectile flight + direct/splash hit
    effects.ts               beams + explosions + particles + shake decay
    upgrades.ts              upgrade tree + apply/sell
  render/                    R3F layer — reads sim, renders
    Scene.tsx                Canvas + lights
    CameraRig.tsx            ortho camera + screenshake offset
    Ground.tsx
    PathLine.tsx
    EnemyMesh.tsx            instanced per-kind with hit flash + slow tint
    TowerMesh.tsx            instanced per-kind with turret rotation + selection ring
    ProjectileMesh.tsx       direct vs splash projectiles
    Effects.tsx              particles, explosions, chain-lightning beams
    Placement.tsx            hover preview + click-to-place-or-select
    SimTicker.tsx            drives sim.step each frame
  ui/
    HUD.tsx                  stats, tower picker, help bar, game-over overlay
    TowerPanel.tsx           selected-tower upgrade + sell UI
  audio/
    AudioManager.ts          WebAudio preloader + playback
    useAudioBridge.ts        subscribes to sim events, plays SFX
public/
  audio/                     curated SFX + music (copied from ../3d-assets/sounds/)
src-tauri/                   Tauri v2 desktop shell
```

## Architecture

**Sim never imports from `render/`, `three`, or `react`. Render never mutates sim state.** This split is load-bearing — it's what lets us do deterministic replays, headless tests, and clean pause/resume later. Keep it clean.

Sim runs at fixed 60 Hz. Render reads the world from a ref and renders at display rate. Game events (`shoot`, `impact`, `death`, `wave-start`, etc.) are pushed to a queue each tick and drained by the store into a subscriber list — audio is one subscriber.

## Assets

Audio is sourced from `../3d-assets/sounds/` (real MP3s, copied to `public/audio/`).

Models:
- `public/models/walker.glb` (allosaur enemy) — from `../3d-assets/models/glb/star_wars_at-st.glb`
- `public/models/flyer.glb` (swarm enemy) — from `../3d-assets/models/glb/star_wars_x-wing.glb`

Other enemies and all towers are primitives. Many named GLBs in `../3d-assets/` (including the dino pack and sci-fi turrets) are git-lfs pointer files and haven't been pulled — `../3d-assets/` is not itself a git repo, so `git lfs pull` can't run there. To add more real GLBs: drop them into `public/models/` and reference via `<ModelEnemyMesh>` in `render/Scene.tsx`.

## License

Unlicensed for now. TBD before launch.
