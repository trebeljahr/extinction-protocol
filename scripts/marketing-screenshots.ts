#!/usr/bin/env tsx
/**
 * Drive the running dev server through a scripted play session, capturing
 * 1920×1080 PNG screenshots for storefront use (Steam, itch, mobile).
 *
 * Requires `pnpm dev` (or another vite preview) already running. Defaults
 * to http://localhost:55743 but reads SCREENSHOT_URL if set. Output dir
 * defaults to the ricos.site Obsidian vault but reads SCREENSHOT_OUT.
 *
 * Run: `pnpm exec tsx scripts/marketing-screenshots.ts`
 *
 * Each biome gets a fresh browser context to avoid R3F memory pressure that
 * accumulates across levels (early runs timed out around level 3-5).
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";

const URL = process.env.SCREENSHOT_URL ?? "http://localhost:55743";
const OUT = resolve(
  process.env.SCREENSHOT_OUT ??
    "/Users/rico/projects/ricos.site/src/content/Notes/assets/project-notes/mesozoic-protocol/screenshots",
);
const W = 1920;
const H = 1080;

const BIOME_LEVELS: Array<{ id: number; biome: string }> = [
  { id: 1, biome: "forest" },
  { id: 7, biome: "snow" },
  { id: 12, biome: "desert" },
  { id: 17, biome: "wasteland" },
  { id: 22, biome: "lava" },
  { id: 27, biome: "alien" },
];

// Grid of click positions — path-blocked ones get rejected by canPlaceAt;
// open spots get a tower.
const PLACE_GRID: Array<[number, number]> = [
  [650, 380],
  [820, 360],
  [990, 380],
  [1160, 360],
  [1330, 380],
  [1500, 400],
  [650, 580],
  [820, 600],
  [990, 580],
  [1160, 600],
  [1330, 580],
  [1500, 600],
  [760, 480],
  [1240, 480],
];

const seedSaveJs = `
(() => {
  const data = {
    version: 1,
    // Only unlock the first 29 — putting a star on L30 fires the "Campaign
    // Complete" achievement, which spawns a toast over every in-level shot.
    starsByLevel: Object.fromEntries(Array.from({length:29},(_,i)=>[i+1,1])),
    encountered: {raptor:true,swarm:true,para:true,allosaur:true,stego:true,armored:true,titan:true,boss:true},
    matriarchsEncountered: {},
    stats: {killsTotal: 0, winsTotal: 0},
    unlocked: {},
    difficulty: "medium",
    seenIntros: Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,true])),
    metaSkills: {},
    activeHero: "george",
    heroUnlocks: {george:true},
    heroXp: {},
    heroSkills: {},
  };
  localStorage.setItem(
    "mesozoic-protocol:slot:1:v1",
    JSON.stringify({ progress: data, meta: { name: "Save 1", lastPlayed: Date.now() } })
  );
})();
`;

async function shot(page: Page, name: string): Promise<void> {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, type: "png", timeout: 30000 });
  console.log(`  → ${name}.png`);
}

async function settle(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

async function clickByText(page: Page, text: string): Promise<boolean> {
  const loc = page
    .locator(`button:has-text("${text}"), [role="button"]:has-text("${text}")`)
    .first();
  if ((await loc.count()) === 0) return false;
  await loc.click({ timeout: 2000 }).catch(() => {});
  return true;
}

async function startLevel(page: Page, id: number): Promise<void> {
  await page.evaluate((lvlId) => {
    const w = window as unknown as {
      __EP_GAME_STORE__?: { getState(): { startLevel(n: number): void } };
    };
    if (!w.__EP_GAME_STORE__)
      throw new Error("__EP_GAME_STORE__ not on window — is dev build running?");
    w.__EP_GAME_STORE__.getState().startLevel(lvlId);
  }, id);
}

async function enableFreeTowers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __EP_GAME_STORE__?: { setState(s: Record<string, unknown>): void };
    };
    w.__EP_GAME_STORE__?.setState({ freeTowers: true });
  });
}

async function clearToasts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __EP_GAME_STORE__?: { setState(s: Record<string, unknown>): void };
    };
    w.__EP_GAME_STORE__?.setState({ achievementToasts: [] });
  });
}

async function dismissBriefing(page: Page): Promise<void> {
  for (const text of ["Begin", "Start", "Deploy", "Continue", "Skip"]) {
    if (await clickByText(page, text)) return;
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function placeTowers(page: Page, kind: string): Promise<void> {
  await page.keyboard.press(kind);
  await settle(page, 150);
  for (const [x, y] of PLACE_GRID) {
    await page.mouse.click(x, y);
    await settle(page, 40);
  }
  // No Escape press — Esc opens the pause menu when nothing is selected, which
  // covers the next screenshot. Drop the current tower-kind cursor via the
  // store instead.
  await page.evaluate(() => {
    const w = window as unknown as {
      __EP_GAME_STORE__?: { getState(): { setSelectedKind(k: null): void } };
    };
    w.__EP_GAME_STORE__?.getState().setSelectedKind(null);
  });
  await settle(page, 200);
}

async function fresh(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  return await ctx.newPage();
}

async function bootToSaveSlot(page: Page): Promise<void> {
  await page.goto(URL);
  await page.evaluate(seedSaveJs);
  await page.reload();
  // Vite keeps an HMR websocket open so `networkidle` never fires — wait
  // for `load` only, then let the React tree mount via a fixed delay.
  await page.waitForLoadState("load");
  await settle(page, 1200);
}

async function waitForScreen(page: Page, target: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cur = await page.evaluate(() => {
      const w = window as unknown as { __EP_GAME_STORE__?: { getState(): { screen?: string } } };
      return w.__EP_GAME_STORE__?.getState().screen ?? "";
    });
    if (cur === target) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for screen=${target}`);
}

async function enterSaveSlot(page: Page): Promise<void> {
  // Slot button classes differ between "Start" (empty slot) and "Continue"
  // (slot with save data). Call the store action directly to avoid that
  // selector flake.
  await page.evaluate(() => {
    const w = window as unknown as {
      __EP_GAME_STORE__?: { getState(): { selectSlot(id: 1 | 2 | 3): void } };
    };
    w.__EP_GAME_STORE__?.getState().selectSlot(1);
  });
  await waitForScreen(page, "worldMap");
  // Let the R3F scene finish decoding GLBs after the React transition.
  await settle(page, 4000);
}

async function captureBiome(browser: Browser, id: number, biome: string): Promise<void> {
  console.log(`Level ${id} (${biome}):`);
  const page = await fresh(browser);
  try {
    await bootToSaveSlot(page);
    await enterSaveSlot(page);
    await clearToasts(page);
    await startLevel(page, id);
    await settle(page, 4500);
    await dismissBriefing(page);
    await settle(page, 1000);
    await clearToasts(page);
    await enableFreeTowers(page);

    await shot(page, `${String(id).padStart(2, "0")}-${biome}-a-empty`);

    await placeTowers(page, "1");
    await placeTowers(page, "2");
    await settle(page, 500);
    await shot(page, `${String(id).padStart(2, "0")}-${biome}-b-placed`);

    await page.keyboard.press("Space");
    await settle(page, 5500);
    await clearToasts(page);
    await shot(page, `${String(id).padStart(2, "0")}-${biome}-c-wave`);

    await settle(page, 5000);
    await clearToasts(page);
    await shot(page, `${String(id).padStart(2, "0")}-${biome}-d-late`);
  } finally {
    await page.context().close();
  }
}

async function captureFront(browser: Browser): Promise<void> {
  console.log("Title + world map:");
  const page = await fresh(browser);
  try {
    await bootToSaveSlot(page);
    await shot(page, "01-title-screen");
    await enterSaveSlot(page);
    await clearToasts(page);
    // Extra render time for the world-map 3D scene; the first run frequently
    // captured a blank canvas because the GLB cache hadn't finished decoding.
    await settle(page, 4000);
    await shot(page, "02-world-map");
  } finally {
    await page.context().close();
  }
}

async function capturePanels(browser: Browser): Promise<void> {
  console.log("UI panels:");
  // Each panel opened via store action (text-based click was case-sensitive
  // against the CSS-uppercased button labels and silently no-op'd).
  const panels: Array<{ name: string; action: string }> = [
    { name: "compendium", action: "setCompendiumOpen" },
    { name: "achievements", action: "setAchievementsOpen" },
    { name: "heroes", action: "setHeroShopOpen" },
  ];
  for (const { name, action } of panels) {
    const page = await fresh(browser);
    try {
      await bootToSaveSlot(page);
      await enterSaveSlot(page);
      await clearToasts(page);
      const opened = await page.evaluate((act) => {
        const w = window as unknown as {
          __EP_GAME_STORE__?: { getState(): Record<string, unknown> };
        };
        const state = w.__EP_GAME_STORE__?.getState();
        const fn = state?.[act] as ((open: boolean) => void) | undefined;
        if (typeof fn !== "function") return false;
        fn(true);
        return true;
      }, action);
      if (!opened) {
        console.log(`  (no ${action} action on store, skipped)`);
        continue;
      }
      await settle(page, 1200);
      await shot(page, `90-panel-${name}`);
    } finally {
      await page.context().close();
    }
  }
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  console.log(`Capturing to: ${OUT}`);

  const browser = await chromium.launch();
  try {
    await captureFront(browser);
    for (const { id, biome } of BIOME_LEVELS) {
      await captureBiome(browser, id, biome);
    }
    await capturePanels(browser);
  } finally {
    await browser.close();
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
