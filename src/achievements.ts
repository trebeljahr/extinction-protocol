import type { FC } from "react";
import { LEVELS } from "./levels";
import type { ProgressData } from "./progress";
import { getStars, starsForLives } from "./progress";
import type { EnemyKind, GameEvent, TowerKind, World } from "./sim/types";
import { ACHIEVEMENT_ICONS, type AchievementIconProps } from "./ui/AchievementIcons";

export type AchievementId =
  | "first_blood"
  | "extermination"
  | "apex_hunter"
  | "veteran"
  | "scholar"
  | "full_arsenal"
  | "fully_armed"
  | "architect"
  | "flawless"
  | "triple_star"
  | "full_spectrum"
  | "master_engineer"
  | "campaign"
  | "perfect_run"
  | "full_service"
  | "tree_hugger"
  | "diamond_in_the_rough"
  | "whispering_skull"
  | "mushroom_puff"
  | "torch_lit"
  | "barrel_roll"
  | "cabin_smoke"
  | "crystal_shatter"
  | "cactus_bloom"
  | "ancient_glyph"
  | "rusted_radio"
  | "satellite_ping"
  | "fairy_ring"
  | "rocket_launch"
  | "tumbleweed"
  | "rover_roam"
  | "baby_raptor"
  | "buried_para"
  | "ghost_trike"
  | "haunted_ruins";

export type AchievementSecrecy = "visible" | "hint" | "hidden";

export type AchievementDef = {
  id: AchievementId;
  name: string;
  desc: string;
  hint: string;
  secrecy?: AchievementSecrecy;
  icon: FC<AchievementIconProps>;
};

type AchievementDefRaw = Omit<AchievementDef, "icon">;

const hintAch = (
  id: AchievementId,
  name: string,
  desc: string,
  hint: string,
): AchievementDefRaw => ({ id, name, desc, hint, secrecy: "hint" });

const ACHIEVEMENTS_RAW: AchievementDefRaw[] = [
  {
    id: "first_blood",
    name: "First Blood",
    desc: "Eliminate your first runaway dinosaur.",
    hint: "Any kill counts.",
  },
  {
    id: "extermination",
    name: "Extermination",
    desc: "Eliminate 500 runaway dinosaurs across all runs.",
    hint: "Lifetime kills.",
  },
  {
    id: "apex_hunter",
    name: "Apex Hunter",
    desc: "Eliminate 2,500 runaway dinosaurs across all runs.",
    hint: "Lifetime kills.",
  },
  {
    id: "veteran",
    name: "Veteran",
    desc: "Win 10 missions across all runs.",
    hint: "Lifetime mission wins.",
  },
  {
    id: "scholar",
    name: "Scholar",
    desc: "Catalog every enemy species.",
    hint: "Encounter all 7 species.",
  },
  {
    id: "full_arsenal",
    name: "Full Arsenal",
    desc: "Build all six tower types in a single mission.",
    hint: "Pulse + Chain + Cryo + Mortar + Flame + Hive.",
  },
  {
    id: "fully_armed",
    name: "Fully Armed",
    desc: "Fully upgrade both branches of a single tower.",
    hint: "Tier 3 on A and B.",
  },
  {
    id: "architect",
    name: "Architect",
    desc: "Deploy ten towers in a single mission.",
    hint: "Ten standing at once.",
  },
  {
    id: "flawless",
    name: "Flawless",
    desc: "Win a mission without losing a single life.",
    hint: "All 20 lives intact.",
  },
  {
    id: "triple_star",
    name: "Triple Star",
    desc: "Earn a three-star rating on any mission.",
    hint: "First perfect clear.",
  },
  {
    id: "full_spectrum",
    name: "Full Spectrum",
    desc: "Face every enemy species and build every tower type in one mission.",
    hint: "Late-game map + every tower.",
  },
  {
    id: "master_engineer",
    name: "Master Engineer",
    desc: "Have one of every tower type fully upgraded at once.",
    hint: "Six towers, each tier 3 on both branches.",
  },
  {
    id: "campaign",
    name: "Campaign Complete",
    desc: "Win every mission.",
    hint: "Clear the whole map.",
  },
  {
    id: "perfect_run",
    name: "Perfect Run",
    desc: "Earn three stars on every mission.",
    hint: "Max rating everywhere.",
  },
  {
    id: "full_service",
    name: "Full Service",
    desc: "Have every tower on the map serviced by a Hive drone.",
    hint: "Every non-hive tower needs at least one drone assigned.",
  },
  hintAch(
    "tree_hugger",
    "Tree Hugger",
    "Click the same tree ten times.",
    "Some trees are hiding more than shade.",
  ),
  hintAch(
    "diamond_in_the_rough",
    "Diamond in the Rough",
    "Click the same rock ten times.",
    "Persistence cracks more than stone.",
  ),
  hintAch(
    "whispering_skull",
    "Whispering Skull",
    "Disturb the skull of the fallen.",
    "The dead have things to say.",
  ),
  hintAch(
    "mushroom_puff",
    "Mushroom Puff",
    "Squish a mushroom loose.",
    "Some fungi don't like being poked.",
  ),
  hintAch("torch_lit", "Light the Way", "Ignite a snowbound torch.", "Cold places need fire."),
  hintAch(
    "barrel_roll",
    "Barrel Roll",
    "Knock over an abandoned barrel.",
    "Not every barrel is staying put.",
  ),
  hintAch(
    "cabin_smoke",
    "Home Fires",
    "Make smoke rise from a snow cabin.",
    "Someone might still live there.",
  ),
  hintAch(
    "crystal_shatter",
    "Crystal Shatter",
    "Shatter a crystal formation.",
    "Crystals break on the fifth tap.",
  ),
  hintAch(
    "cactus_bloom",
    "Cactus Bloom",
    "Coax a desert plant to flower.",
    "Even cacti have a soft side.",
  ),
  hintAch(
    "ancient_glyph",
    "Ancient Glyph",
    "Uncover the meaning of carved stone.",
    "Worn markings light up under touch.",
  ),
  hintAch(
    "rusted_radio",
    "Static Response",
    "Tune into a forgotten transmission.",
    "The dead network still hums.",
  ),
  hintAch(
    "satellite_ping",
    "Distant Signal",
    "Wake a dormant satellite dish.",
    "Some dishes still listen.",
  ),
  hintAch(
    "fairy_ring",
    "Fairy Ring",
    "Disturb a wild ring of blooms.",
    "Flowers answer the third visitor.",
  ),
  hintAch(
    "rocket_launch",
    "Rocket Launch",
    "Launch a forgotten rocket skyward.",
    "Countdown starts at three.",
  ),
  hintAch(
    "tumbleweed",
    "Tumbleweed",
    "Catch a rolling tumbleweed in motion.",
    "Watch the desert — something rolls.",
  ),
  hintAch(
    "rover_roam",
    "Rover Roam",
    "Stop a wasteland rover mid-drive.",
    "The wastes aren't entirely deserted.",
  ),
  hintAch(
    "baby_raptor",
    "Baby Raptor",
    "Find a hatchling hiding in the forest.",
    "Small things hide among the trees.",
  ),
  hintAch(
    "buried_para",
    "Dig Out",
    "Shake a snowbound Parasaur free.",
    "Someone's stuck in the snow.",
  ),
  hintAch(
    "ghost_trike",
    "Phantom Trike",
    "Catch a translucent Triceratops passing by.",
    "Not all the dead stayed dead.",
  ),
  hintAch(
    "haunted_ruins",
    "Haunted Ruins",
    "Wake the spirits of the wasteland.",
    "Old stones answer three knocks.",
  ),
];

export const ACHIEVEMENTS: AchievementDef[] = ACHIEVEMENTS_RAW.map((a) => ({
  ...a,
  icon: ACHIEVEMENT_ICONS[a.id],
}));

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
) as Record<AchievementId, AchievementDef>;

export const TOTAL_ENEMY_KINDS = 7;

const ALL_TOWER_KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar", "flame", "hive"];
const ALL_ENEMY_KINDS: EnemyKind[] = [
  "raptor",
  "swarm",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
];

export const isAchievementUnlocked = (p: ProgressData, id: AchievementId): boolean =>
  p.unlocked[id] !== undefined;

export const totalUnlocked = (p: ProgressData): number =>
  ACHIEVEMENTS.reduce((n, a) => n + (isAchievementUnlocked(p, a.id) ? 1 : 0), 0);

const satisfies = (id: AchievementId, p: ProgressData, w: World, ev: GameEvent | null): boolean => {
  switch (id) {
    case "first_blood":
      return p.stats.killsTotal >= 1;
    case "extermination":
      return p.stats.killsTotal >= 500;
    case "apex_hunter":
      return p.stats.killsTotal >= 2500;
    case "veteran":
      return p.stats.winsTotal >= 10;
    case "scholar": {
      let seen = 0;
      for (const k in p.encountered) if (p.encountered[k as keyof typeof p.encountered]) seen++;
      return seen >= TOTAL_ENEMY_KINDS;
    }
    case "full_arsenal": {
      if (w.towers.length < ALL_TOWER_KINDS.length) return false;
      const kinds = new Set(w.towers.map((t) => t.kind));
      return ALL_TOWER_KINDS.every((k) => kinds.has(k));
    }
    case "fully_armed":
      return w.towers.some((t) => t.upgrades.a === 3 && t.upgrades.b === 3);
    case "architect":
      return w.towers.length >= 10;
    case "flawless":
      return ev !== null && ev.type === "game-over" && ev.won && w.lives >= w.startLives;
    case "triple_star":
      // Three-star wording assumes the normal-mode 0-3 grading. Heroic /
      // iron are binary (clear = 1 star), so the achievement only fires
      // for full-lives normal clears.
      return (
        ev !== null &&
        ev.type === "game-over" &&
        ev.won &&
        w.mode === "normal" &&
        starsForLives(w.lives) === 3
      );
    case "full_spectrum":
      return (
        ALL_ENEMY_KINDS.every((k) => w.runEnemyKinds[k]) &&
        ALL_TOWER_KINDS.every((k) => w.runTowerKinds[k])
      );
    case "master_engineer": {
      const maxed: Partial<Record<TowerKind, boolean>> = {};
      for (const t of w.towers) {
        if (t.upgrades.a === 3 && t.upgrades.b === 3) maxed[t.kind] = true;
      }
      return ALL_TOWER_KINDS.every((k) => maxed[k]);
    }
    case "campaign":
      return LEVELS.every((l) => getStars(p, l.id) >= 1);
    case "perfect_run":
      return LEVELS.every((l) => getStars(p, l.id) >= 3);
    case "full_service": {
      // Need at least one non-hive tower (otherwise the trivial empty
      // case would award immediately) AND every non-hive tower must
      // have at least one hive drone currently assigned to it.
      const nonHive = w.towers.filter((t) => t.kind !== "hive");
      if (nonHive.length === 0) return false;
      const serviced = new Set<number>();
      for (const h of w.towers) {
        if (h.kind !== "hive") continue;
        for (let i = 0; i < h.droneCount; i++) {
          const id = h.droneAssignments[i];
          if (id !== null && id !== undefined) serviced.add(id);
        }
      }
      return nonHive.every((t) => serviced.has(t.id));
    }
    case "tree_hugger":
    case "diamond_in_the_rough":
    case "whispering_skull":
    case "mushroom_puff":
    case "torch_lit":
    case "barrel_roll":
    case "cabin_smoke":
    case "crystal_shatter":
    case "cactus_bloom":
    case "ancient_glyph":
    case "rusted_radio":
    case "satellite_ping":
    case "fairy_ring":
    case "rocket_launch":
    case "tumbleweed":
    case "rover_roam":
    case "baby_raptor":
    case "buried_para":
    case "ghost_trike":
    case "haunted_ruins":
      return false;
  }
};

export const checkAchievements = (
  progress: ProgressData,
  world: World,
  ev: GameEvent | null,
): { progress: ProgressData; unlocked: AchievementId[] } => {
  let p = progress;
  const unlocked: AchievementId[] = [];
  for (const def of ACHIEVEMENTS) {
    if (isAchievementUnlocked(p, def.id)) continue;
    if (satisfies(def.id, p, world, ev)) {
      p = { ...p, unlocked: { ...p.unlocked, [def.id]: Date.now() } };
      unlocked.push(def.id);
    }
  }
  return { progress: p, unlocked };
};
