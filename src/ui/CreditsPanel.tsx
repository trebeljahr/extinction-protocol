import { useEffect } from "react";
import { audio } from "../audio/AudioManager";
import { useGame } from "../store";

type CreditEntry = {
  name: string;
  creator?: string;
  license?: string;
  url?: string;
  // When source/creator is unknown, show a visible placeholder. The matching
  // TODO comment in the data block tells Rico exactly which asset path to
  // research without grepping the codebase.
  unknown?: boolean;
};

type CreditSection = {
  title: string;
  entries: CreditEntry[];
};

// Attribution sourced from in-repo comments where available:
//  - /models/scifi/*       → Kenney "Space Kit" (src/render/BiomeCosmetics.tsx, src/biomes.ts)
//  - /models/landmarks/snow/Cabin.glb → Kenney "Hexagon Kit" (src/easterEggs.ts)
//  - /models/biomes/alien/* → Quaternius "Ultimate Space Kit" (src/biomes.ts)
//  - /models/nature/* and biome rocks/bushes → Quaternius generic nature kits
//    (src/render/Rocks.tsx, src/biomes.ts)
//  - Hive drone primitive → Quaternius "Enemy Flying" (src/render/HiveDrones.tsx)
// Anything not covered above is marked with a TODO so it can be filled in
// without guessing.
const SECTIONS: CreditSection[] = [
  {
    title: "3D Models",
    entries: [
      {
        name: "Sci-fi props (machines, satellite dishes, hangars, rocket bases, rover, barrels, crystals, structures, meteor)",
        creator: "Kenney",
        license: "CC0 1.0",
        url: "https://kenney.nl/assets/space-kit",
      },
      {
        name: "Snow cabin (landmarks/snow/Cabin.glb)",
        creator: "Kenney",
        license: "CC0 1.0",
        url: "https://kenney.nl/assets/hexagon-kit",
      },
      {
        name: "Alien biome vegetation (biomes/alien/*)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/ultimatespacekit.html",
      },
      {
        name: "Generic nature props (nature/Bush*, Grass*, Rock*, Tree*)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/",
      },
      {
        name: "Biome rocks, bushes, and trees (biomes/desert, biomes/snow, biomes/wasteland)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/",
      },
      {
        name: "Hive drone mesh (Enemy Flying)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/",
      },
      // TODO: confirm source for /models/Apatosaurus.glb, Parasaurolophus.glb,
      // Stegosaurus.glb, Trex.glb, Triceratops.glb, Velociraptor.glb
      {
        name: "Dinosaur enemies (Apatosaurus, Parasaurolophus, Stegosaurus, Trex, Triceratops, Velociraptor)",
        unknown: true,
      },
      // TODO: confirm source for /models/turrets/*.glb (Drone, Emp Turret,
      // Flamethrower Turret, Gatelng Gun Turret, Gun Cannon Turret, Hive
      // Turret, Lighting Turret, Missile Turret, Plasma Turret, Rail Gun
      // Turret, Shield Turret)
      {
        name: "Tower meshes (turrets/*.glb)",
        unknown: true,
      },
      // TODO: confirm source for /models/tower_chain.glb, tower_pulse.glb,
      // turret_emp.glb, turret_missile.glb (root-level turret variants)
      {
        name: "Legacy turret meshes (tower_chain.glb, tower_pulse.glb, turret_emp.glb, turret_missile.glb)",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/forest/* (Barrel,
      // BushFlowers, House, Mushroom, Sawmill)
      {
        name: "Forest landmarks (Barrel, BushFlowers, House, Mushroom, Sawmill)",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/desert/* (Chest, DeadTree,
      // Skull, Tent)
      {
        name: "Desert landmarks (Chest, DeadTree, Skull, Tent)",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/snow/* (Crystal1, Tent,
      // Torch — Cabin attributed above)
      {
        name: "Snow landmarks (Crystal1, Tent, Torch)",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/wasteland/* (Crystal1,
      // DeadTree, Ruins, Skull)
      {
        name: "Wasteland landmarks (Crystal1, DeadTree, Ruins, Skull)",
        unknown: true,
      },
    ],
  },
  {
    title: "Audio",
    entries: [
      // TODO: confirm source for SFX in public/audio/*.mp3 — death, defeat,
      // game-over, impact, level-select, life-lost, music-ambient, new-enemy,
      // shoot-chain, shoot-cryo, shoot-mortar, shoot-pulse, star,
      // tower-place, tower-select, tower-sell, ui-click, ui-close, ui-error,
      // ui-open, ui-tab, upgrade, victory, wave-call, wave-clear, wave-start
      {
        name: "Sound effects (UI clicks, tower fire, wave cues, victory/defeat stings, etc.)",
        unknown: true,
      },
      // TODO: confirm source for biome music tracks in public/audio/music/ —
      // alien.mp3, desert.mp3, forest.mp3, lava.mp3, snow.mp3, wasteland.mp3
      {
        name: "Biome music tracks (alien, desert, forest, lava, snow, wasteland)",
        unknown: true,
      },
    ],
  },
  {
    title: "Fonts",
    entries: [
      {
        name: "Rajdhani (display font)",
        creator: "Indian Type Foundry",
        license: "SIL Open Font License 1.1",
        url: "https://fonts.google.com/specimen/Rajdhani",
      },
    ],
  },
  {
    title: "Icons",
    entries: [
      // TODO: confirm source for public/icons/* (32x32.png, 128x128.png,
      // icon.png) — app/window icons used by index.html and Tauri.
      {
        name: "App icons (public/icons/*)",
        unknown: true,
      },
    ],
  },
  {
    title: "Third-party libraries",
    entries: [
      {
        name: "React, React DOM",
        creator: "Meta",
        license: "MIT",
        url: "https://react.dev",
      },
      {
        name: "three.js",
        creator: "three.js authors",
        license: "MIT",
        url: "https://threejs.org",
      },
      {
        name: "@react-three/fiber",
        creator: "Poimandres",
        license: "MIT",
        url: "https://github.com/pmndrs/react-three-fiber",
      },
      {
        name: "@react-three/drei",
        creator: "Poimandres",
        license: "MIT",
        url: "https://github.com/pmndrs/drei",
      },
      {
        name: "@react-three/postprocessing",
        creator: "Poimandres",
        license: "MIT",
        url: "https://github.com/pmndrs/react-postprocessing",
      },
      {
        name: "postprocessing",
        creator: "Raoul van Rüschen",
        license: "Zlib",
        url: "https://github.com/pmndrs/postprocessing",
      },
      {
        name: "three-stdlib",
        creator: "Poimandres",
        license: "MIT",
        url: "https://github.com/pmndrs/three-stdlib",
      },
      {
        name: "zustand",
        creator: "Poimandres",
        license: "MIT",
        url: "https://github.com/pmndrs/zustand",
      },
      {
        name: "nanoid",
        creator: "Andrey Sitnik",
        license: "MIT",
        url: "https://github.com/ai/nanoid",
      },
      {
        name: "Tailwind CSS",
        creator: "Tailwind Labs",
        license: "MIT",
        url: "https://tailwindcss.com",
      },
      {
        name: "Vite",
        creator: "Vite contributors",
        license: "MIT",
        url: "https://vitejs.dev",
      },
      {
        name: "@vitejs/plugin-react",
        creator: "Vite contributors",
        license: "MIT",
        url: "https://github.com/vitejs/vite-plugin-react",
      },
      {
        name: "TypeScript",
        creator: "Microsoft",
        license: "Apache-2.0",
        url: "https://www.typescriptlang.org",
      },
      {
        name: "Biome",
        creator: "Biome contributors",
        license: "MIT / Apache-2.0",
        url: "https://biomejs.dev",
      },
      {
        name: "Tauri",
        creator: "Tauri contributors",
        license: "MIT / Apache-2.0",
        url: "https://tauri.app",
      },
      {
        name: "Husky",
        creator: "Typicode",
        license: "MIT",
        url: "https://github.com/typicode/husky",
      },
      {
        name: "lint-staged",
        creator: "Andrey Okonetchnikov",
        license: "MIT",
        url: "https://github.com/lint-staged/lint-staged",
      },
    ],
  },
];

export const CreditsPanel = () => {
  const setCreditsOpen = useGame((s) => s.setCreditsOpen);

  useEffect(() => {
    audio.ui("open");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setCreditsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setCreditsOpen]);

  return (
    <div className="overlay achievements-overlay">
      <div className="achievements-card">
        <header className="achievements-header">
          <div>
            <h1>Credits</h1>
            <div className="achievements-subtitle">Assets, libraries, and tools</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setCreditsOpen(false)}>
            Close (Esc)
          </button>
        </header>

        <div className="credits-body">
          {SECTIONS.map((section) => (
            <section key={section.title} className="credits-section">
              <h2 className="credits-section-title">{section.title}</h2>
              <ul className="credits-list">
                {section.entries.map((entry) => (
                  <li key={`${section.title}-${entry.name}`} className="credits-row">
                    <div className="credits-row-name">{entry.name}</div>
                    <div className="credits-row-meta">
                      {entry.unknown ? (
                        <span className="credits-tbd">Source TBD</span>
                      ) : (
                        <>
                          {entry.creator && (
                            <span className="credits-creator">{entry.creator}</span>
                          )}
                          {entry.license && (
                            <span className="credits-license">{entry.license}</span>
                          )}
                          {entry.url && (
                            <a
                              className="credits-url"
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Source ↗
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
