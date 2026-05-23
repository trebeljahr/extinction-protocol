# i18n — remaining work

This was an intentionally **partial** extraction. The high-traffic surfaces are
fully wired to `react-i18next` and translated into German (`de`). Everything
below is still hardcoded English and needs extracting into the catalog under
`src/locales/<lang>/`.

## How it's set up (read first)

- Framework: **i18next + react-i18next**, JSON catalogs in `src/locales/`.
- `src/locales/en/` is the **source of truth**. `de/` is a complete translation.
  `zh-CN/` and `pt-BR/` are en copies (contributor stubs) and are **not** wired
  into the runtime (`src/i18n/index.ts` only loads `en` + `de`).
- Namespaces: `ui`, `enemies`, `towers`, `mechanics`, `achievements`, `modes`.
- Config + language switching live in `src/i18n/index.ts`
  (`SUPPORTED_LANGUAGES`, `changeLanguage`, `TRANSLATION_PROJECT_URL`).
- Run `pnpm check:i18n` after editing any catalog — it fails on missing/extra
  keys vs `en` and warns on UI strings >40% longer than English.
- A new locale = add the dir, translate all six namespaces, add it to
  `SUPPORTED_LANGUAGES` + the `resources` map in `src/i18n/index.ts`.

## Done (already extracted + translated)

Main menu / splash / world-map chrome, HUD, pause menu, settings
(`SoundControls`, `FullscreenToggle`, `QuickSettings`, `LanguageControls`),
results screen, mode + difficulty pickers, `TowerPanel`, `EnemyPanel`,
`AchievementsPanel`. Centralized content in `enemyText.ts`, `towerText.ts`,
`mechanicsText.ts`, `achievements.ts`, and the mode/difficulty labels in
`progress.ts` now source their English from the `en` catalog.

## Decisions to keep

- **Proper nouns stay English in every locale** (not in the catalog): tower
  names (`TOWER_LABEL`), enemy/boss species names (`ENEMY_LABEL`,
  `BOSS_VARIANT_LABEL`), pilot names, hero ability names, "Mesozoic Protocol",
  "Kairos Corp".
- `DAMAGE_TYPE_LABEL` in `src/sim/world.ts` stays English for sim/render
  consumers; the translatable copy lives in `ui.damageTypes.*`. If you localize
  more render-layer text, mirror new damage-type usage through that key.

## Remaining strings → target namespace

### Prose content (catalogs not yet created)
- `src/levels/briefings.ts` — `LEVEL_BRIEFING`, `LEVEL_INTERSTITIAL` → new
  `briefings.json`. Surfaced in `WorldMapUI` hover card + `LevelIntro`.
- `src/levels/lore.ts` — "Field Report" lore → new `lore.json`. Surfaced in
  `Compendium` (lore tab).

### Tower upgrades (catalog not yet created)
- `src/sim/upgrades.ts` — `UPGRADES[kind].{a,b}.label`, each tier `name`/`desc`,
  and `STAT_LABEL` → new `upgrades.json`. Consumed by `TowerPanel` `BranchView`
  (currently the only English left in that panel) and the upgrade preview rows.

### Robots (catalog not yet created)
- `src/sim/robotSkills.ts`, `src/sim/metaSkills.ts` skill names/descriptions,
  and `src/ui/RobotPanel.tsx`, `RobotShop.tsx`, `RobotSelectionPanel.tsx`,
  `SkillTreePanel.tsx`, `RobotCompendiumSection.tsx` chrome → new `robots.json`.
  Keep pilot names + ability names English (proper nouns); translate descriptions.

### Compendium + alerts (catalogs exist — just wire `t()`)
- `src/ui/Compendium.tsx` — tab labels, section headers, and inline chrome →
  `ui` (new `compendium.*` block). Switch its `enemyText`/`towerText`/
  `mechanicsText` reads to `t('enemies:…')` / `t('towers:…')` / `t('mechanics:…')`
  — those `de` strings already exist.
- `src/ui/NewEnemyAlert.tsx` — dossier chrome → `ui`; enemy copy via `enemies`.
- `src/ui/MechanicPreview.tsx`, `MechanicIcon.tsx` — labels via `mechanics`.

### Remaining UI files with inline strings / aria-labels → `ui`
- `src/ui/SaveSlots.tsx` (save slot chrome, confirm dialogs)
- `src/ui/ConfirmationDialog.tsx` (generic confirm/cancel defaults)
- `src/ui/LevelIntro.tsx`, `LevelLoadOverlay.tsx`
- `src/ui/BossBanner.tsx`, `AchievementToast.tsx`, `ModesUnlockedModal.tsx`
- `src/ui/CreditsPanel.tsx`, `CanvasFailure.tsx`, `ErrorBoundary.tsx`,
  `LandscapeNudge.tsx`
- `src/ui/HiveDronePanel.tsx` ("Pick" slot button — referenced verbatim in the
  already-translated `towerPanel.hiveBlurb`; translating one means updating both)
- `src/ui/TreePanel.tsx`, `BasePanel.tsx`, `PlannerHud.tsx`
- Debug-only (`DebugMenuSection.tsx`, `DebugProgressSettings.tsx`) — low priority.
- `index.html` `<title>` / meta description + `scripts/generate-seo.mjs` — static
  SEO copy; localize only if SSR/per-locale builds are added.

### aria-label / title sweep
Several already-translated panels still have a few `aria-label`s in nested
controls; grep `aria-label="` and `title="` across `src/ui/**` for the
stragglers and route them through `ui`.
