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

// Attribution sources, in order of certainty:
//  1. In-repo comments call out Kenney/Quaternius packs by name in biomes.ts,
//     easterEggs.ts, BiomeCosmetics.tsx, Rocks.tsx, HiveDrones.tsx.
//  2. Embedded glTF metadata in each .glb (mesh names, material names,
//     texture filenames, animation names) was inspected to confirm the
//     source pack — Quaternius's classic palette/color naming and animation
//     suffixes (`_Idle`, `_Walk`, `_Run`, `_Attack`, `_Death`, `_Jump`),
//     Kenney's `Mesh ` mesh prefix + `metal`/`metalDark` materials and
//     `colormap` Hexagon-Kit naming, and the shared `Atlas_Pirate.png`
//     texture in pirate-themed landmarks.
//  3. Audio MP3 ID3 tags were probed with ffprobe — most of the biome music
//     tracks identified themselves as Kevin MacLeod (incompetech.com).
//  4. Anything still unconfirmed (alien/desert music, all SFX) keeps a
//     TODO comment with the asset path and the strongest available clue.
const SECTIONS: CreditSection[] = [
  {
    title: "3D Models",
    entries: [
      {
        name: "Sci-fi props — machines, satellite dishes, hangars, rocket bases, rover, barrels, crystals, structures, meteor (scifi/*)",
        creator: "Kenney",
        license: "CC0 1.0",
        url: "https://kenney.nl/assets/space-kit",
      },
      {
        name: "Hexagon-kit landmarks — Cabin, Crystal1 (snow), Crystal1 (wasteland)",
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
        name: "Stylized nature props — Bush, Grass, Rock, Tree (nature/*)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/stylizednaturemegakit.html",
      },
      {
        name: "Biome rocks, bushes, and trees (biomes/desert, biomes/snow, biomes/wasteland)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/stylizednaturemegakit.html",
      },
      {
        name: "Animated dinosaur enemies — Apatosaurus, Parasaurolophus, Stegosaurus, Trex, Triceratops, Velociraptor",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/animateddinosaurs.html",
      },
      {
        name: "Hive drone + Drone tower mesh (Enemy_Flying / Glub)",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/ultimatemonsters.html",
      },
      {
        name: "Modular turret meshes — EMP, Flamethrower, Gatling, Gun Cannon, Hive, Lightning, Missile, Plasma, Rail Gun, Shield + root-level tower_*/turret_* variants",
        creator: "Quaternius",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/moduladefensekit.html",
      },
      // Forest/desert/wasteland landmarks share a single Atlas_Pirate.png
      // texture and Prop_*/Environment_* mesh naming. Pattern matches
      // Quaternius's free Pirate Pack but the in-glTF metadata doesn't carry
      // an explicit creator tag — leaving a TODO so this can be confirmed
      // against quaternius.com's pack listing rather than assumed.
      // TODO: confirm pack for Atlas_Pirate.png landmarks — Barrel, House,
      // Sawmill (forest); Chest, Skull (desert); Skull, Ruins (wasteland).
      {
        name: "Pirate-themed landmarks — Barrel, House, Sawmill, Chest, Ruins, Skull (Atlas_Pirate.png)",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/forest/BushFlowers.glb
      // (mesh Bush_Common_Flowers, textures Flowers.webp + Leaves_NormalTree_C.webp)
      // and /models/landmarks/forest/Mushroom.glb (mesh Mushroom_Common,
      // texture Mushrooms.webp). The "_Common" suffix and webp textures
      // don't match Quaternius/Kenney conventions.
      {
        name: "Forest detail props — BushFlowers, Mushroom",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/desert/DeadTree.glb and
      // /models/landmarks/wasteland/DeadTree.glb (mesh DeadTree_5, textures
      // Bark_DeadTree.png + Bark_DeadTree_Normal.png). The PBR normal map
      // suggests a different vendor than the palette-only Quaternius packs.
      {
        name: "Dead trees — landmarks/desert/DeadTree, landmarks/wasteland/DeadTree",
        unknown: true,
      },
      // TODO: confirm source for /models/landmarks/desert/Tent.glb,
      // /models/landmarks/snow/Tent.glb, /models/landmarks/snow/Torch.glb.
      // Color-only materials (Black/DarkWood/Green/DarkYellow/LightBlue),
      // no textures — likely a Quaternius pack but no embedded clue.
      {
        name: "Camp props — Tent (desert + snow), Torch (snow)",
        unknown: true,
      },
    ],
  },
  {
    title: "Audio",
    entries: [
      {
        name: "Magic Forest (audio/music/forest.mp3)",
        creator: "Kevin MacLeod",
        license: "CC BY 4.0",
        url: "https://incompetech.com/music/royalty-free/music.html",
      },
      {
        name: "Black Vortex (audio/music/lava.mp3)",
        creator: "Kevin MacLeod",
        license: "CC BY 4.0",
        url: "https://incompetech.com/music/royalty-free/music.html",
      },
      {
        name: "Bittersweet (audio/music/snow.mp3)",
        creator: "Kevin MacLeod",
        license: "CC BY 4.0",
        url: "https://incompetech.com/music/royalty-free/music.html",
      },
      {
        name: "Corruption (audio/music/wasteland.mp3)",
        creator: "Kevin MacLeod",
        license: "CC BY 4.0",
        url: "https://incompetech.com/music/royalty-free/music.html",
      },
      // TODO: confirm source for audio/music/alien.mp3 (16s, 256kbps, no
      // ID3 tags) and audio/music/desert.mp3 (296s, 160kbps, no ID3 tags).
      {
        name: "Biome music — alien, desert",
        unknown: true,
      },
      // TODO: confirm source for SFX in public/audio/*.mp3 — death, defeat,
      // game-over, impact, level-select, life-lost, music-ambient,
      // new-enemy, shoot-chain, shoot-cryo, shoot-mortar, shoot-pulse, star,
      // tower-place, tower-select, tower-sell, ui-click, ui-close, ui-error,
      // ui-open, ui-tab, upgrade, victory, wave-call, wave-clear, wave-start.
      // None carry ID3 tags; if any of these were generated (jsfxr,
      // sfxr-style) that should be noted here too.
      {
        name: "Sound effects — UI clicks, tower fire, wave cues, victory/defeat stings",
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
      // public/icon-source.html renders public/models/tower_pulse.glb to
      // generate icon.png + the 32×32 / 128×128 favicons. The icon credit
      // therefore inherits whatever the tower mesh is licensed under
      // (Quaternius Modular Defense Kit, listed above).
      {
        name: "App icons — public/icons/* (rendered from tower_pulse.glb via public/icon-source.html)",
        creator: "Quaternius (mesh)",
        license: "CC0 1.0",
        url: "https://quaternius.com/packs/moduladefensekit.html",
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
