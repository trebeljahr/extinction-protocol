# Extinction Protocol

Single-player roguelite tower defense. Top-down 3D under orthographic camera. Built with React Three Fiber + TypeScript + Vite, wrapped with Tauri v2 for Steam.

See [DESIGN.md](DESIGN.md) for the full design document.

## Status

**M1 scaffold.** Fixed-timestep simulation, orthographic scene, one tower, one enemy walking a hardcoded path, click-to-place additional towers. Proves the sim/render split and the core loop.

## Prerequisites

- Node.js 20+
- (Optional, for desktop build) Rust toolchain + Tauri prerequisites — see <https://tauri.app/start/prerequisites/>

## Run (web)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

Controls:
- **Click** empty tile — place a Pulse Rifle (50 gold).
- **Space** — pause/resume.
- **R** — restart run.

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
  main.tsx              entry
  App.tsx               root component
  store.ts              Zustand world ref + selector hooks
  level.ts              starting level config (path, waves)
  sim/                  headless simulation (no React, no Three.js)
    types.ts
    vec2.ts
    world.ts            world state + factory
    loop.ts             fixed-timestep accumulator
    path.ts             polyline utilities
    enemies.ts          enemy update
    towers.ts           target acquisition + firing
    projectiles.ts      projectile update + hit resolution
    spawner.ts          wave scheduling
  render/               R3F layer — reads sim, renders
    Scene.tsx
    Ground.tsx
    PathLine.tsx
    EnemyMesh.tsx
    TowerMesh.tsx
    ProjectileMesh.tsx
    SimTicker.tsx       drives sim.step each frame
    Placement.tsx       click-to-place towers
  ui/
    HUD.tsx             gold, lives, wave
src-tauri/              Tauri v2 desktop shell
```

## Architecture

**Sim never imports from `render/`, `three`, or `react`. Render never mutates sim state.** This split is load-bearing — it's what lets us do deterministic replays, headless tests, and clean pause/resume later. Keep it clean.

Sim runs at fixed 60 Hz. Render reads the world from a ref and renders at display rate. No interpolation yet — will add in M2 if it feels stuttery.

## License

Unlicensed for now. TBD before launch.
