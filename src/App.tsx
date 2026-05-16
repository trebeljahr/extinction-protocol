import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { lazy, Suspense, useEffect } from "react";
import { useAudioBridge } from "./audio/useAudioBridge";
import { useGamepadMenuNavigation } from "./input/useGamepadMenuNavigation";
import { PlayScene } from "./render/Scene";
import { useGame } from "./store";
import { AchievementToast } from "./ui/AchievementToast";
import { CanvasFailure } from "./ui/CanvasFailure";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { HUD } from "./ui/HUD";
import { LandscapeNudge } from "./ui/LandscapeNudge";
import { LevelIntro } from "./ui/LevelIntro";
import { NewEnemyAlert } from "./ui/NewEnemyAlert";
import { ResultsScreen } from "./ui/ResultsScreen";
import { SaveSlots } from "./ui/SaveSlots";
import { Splash } from "./ui/Splash";
import { enterFullscreen, isFullscreen, loadFullscreenPref } from "./ui/useFullscreen";
import { useInputModeSignal } from "./ui/useInputMode";
import { useIsMobile } from "./ui/useMediaQuery";
import { WorldMapUI } from "./ui/WorldMapUI";

// Heavy panels and the world-map scene only load when the user actually
// opens them. WorldMapScene pulls all biome models; Compendium and
// AchievementsPanel each carry their own art and copy. Splitting them
// drops the initial JS payload by hundreds of KB.
const WorldMapScene = lazy(() =>
  import("./render/WorldMap").then((m) => ({ default: m.WorldMapScene })),
);
const Compendium = lazy(() => import("./ui/Compendium").then((m) => ({ default: m.Compendium })));
const AchievementsPanel = lazy(() =>
  import("./ui/AchievementsPanel").then((m) => ({ default: m.AchievementsPanel })),
);
const CreditsPanel = lazy(() =>
  import("./ui/CreditsPanel").then((m) => ({ default: m.CreditsPanel })),
);
const DifficultyPicker = lazy(() =>
  import("./ui/DifficultyPicker").then((m) => ({ default: m.DifficultyPicker })),
);
const SkillTreePanel = lazy(() =>
  import("./ui/SkillTreePanel").then((m) => ({ default: m.SkillTreePanel })),
);
const HeroShop = lazy(() => import("./ui/HeroShop").then((m) => ({ default: m.HeroShop })));

const SceneRoot = () => {
  const screen = useGame((s) => s.screen);
  // Suspense fallback is null — Canvas already renders nothing on first
  // frame anyway, and the world-map only shows up post-load.
  return screen === "worldMap" ? (
    <Suspense fallback={null}>
      <WorldMapScene />
    </Suspense>
  ) : (
    <PlayScene />
  );
};

// Lightweight device tier check used to scale bloom kernel and DPR cap.
// `low` = mobile-ish (<=4 logical cores or coarse pointer / mobile UA);
// other devices keep the higher-quality MEDIUM kernel.
const isLowEndDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4) return true;
  if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
};

const lowEnd = isLowEndDevice();
const bloomKernel = lowEnd ? KernelSize.SMALL : KernelSize.MEDIUM;
// Bumped low-end ceiling from 1.75 → 2 so retina phones don't sub-sample
// the framebuffer. Sub-2× on a 3× device produces stair-step edges along
// dinosaur silhouettes that no MSAA pass can fully hide.
const dprCap: [number, number] = lowEnd ? [1, 2] : [1, 2];
// MSAA in the postprocessing composer. The Canvas-level antialias prop
// is bypassed once EffectComposer renders into its own multisample-less
// render target, so silhouettes go jagged. Cheaper sample count on
// low-end devices; 4x is the standard sweet-spot on desktop.
const composerMultisampling = lowEnd ? 2 : 4;

export const App = () => {
  const screen = useGame((s) => s.screen);
  const levelIntroVisible = useGame((s) => s.levelIntroVisible);
  const compendiumOpen = useGame((s) => s.compendiumOpen);
  const achievementsOpen = useGame((s) => s.achievementsOpen);
  const creditsOpen = useGame((s) => s.creditsOpen);
  const difficultyPickerOpen = useGame((s) => s.difficultyPickerOpen);
  const skillTreeOpen = useGame((s) => s.skillTreeOpen);
  const heroShopOpen = useGame((s) => s.heroShopOpen);
  const selectedKind = useGame((s) => s.selectedKind);
  const paused = useGame((s) => s.ui.status === "paused");
  const newEnemyAlertVisible = useGame((s) => s.newEnemyQueue.length > 0);
  const modalOpen =
    compendiumOpen ||
    achievementsOpen ||
    creditsOpen ||
    difficultyPickerOpen ||
    skillTreeOpen ||
    heroShopOpen;
  const isMobile = useIsMobile();
  useInputModeSignal();
  useAudioBridge();
  useGamepadMenuNavigation(
    (screen !== "playing" && screen !== "worldMap") ||
      modalOpen ||
      (screen === "playing" && paused) ||
      levelIntroVisible ||
      newEnemyAlertVisible,
    { confirmAsKeyboard: levelIntroVisible || newEnemyAlertVisible },
  );

  // Drive the cursor from gameplay state. Crosshair on the canvas
  // while a tower kind is selected, default everywhere else. Buttons
  // keep `cursor: pointer` because their rules win on specificity.
  useEffect(() => {
    const cls = "is-placing";
    if (selectedKind !== null) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [selectedKind]);

  // Body class so CSS @media-style mobile overrides can also key off
  // pointer/runtime detection, not just viewport width — covers narrow
  // desktop windows being styled mobile by mistake.
  useEffect(() => {
    const cls = "is-mobile";
    if (isMobile) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [isMobile]);

  // Default-fullscreen on mobile. Triggered the moment the player
  // enters a level, so the gesture (the level-node tap on the world
  // map) still counts as user-activation for the fullscreen API.
  // Honors the user's saved preference: "off" never auto-enters; "on"
  // tries even on desktop; "auto" opts into mobile only.
  useEffect(() => {
    if (screen !== "playing") return;
    if (isFullscreen()) return;
    const pref = loadFullscreenPref();
    if (pref === "off") return;
    if (pref === "auto" && !isMobile) return;
    void enterFullscreen();
  }, [screen, isMobile]);

  // World-map ground can push past the play-scene bloom threshold under
  // the strong directional light (lit snow albedo ~1.0-1.2 in linear after
  // palette darkening). Lift the threshold for the world map so the ground
  // sits below the bloom range — only HDR effects (additive VFX,
  // toneMapped:false particles) ever exceed 2.5 in linear.
  const bloomThreshold = screen === "worldMap" ? 2.5 : 0.82;
  const bloomSmoothing = screen === "worldMap" ? 0.05 : 0.18;

  // Entry-flow screens render standalone — no canvas, no HUD. They
  // sit above everything else and gate access to the gameplay canvas.
  // LandscapeNudge rides along so the rotate prompt appears from the
  // very first menu screen, not only once gameplay starts.
  if (screen === "splash")
    return (
      <>
        <Splash />
        <LandscapeNudge />
      </>
    );
  if (screen === "slots")
    return (
      <>
        <SaveSlots />
        <LandscapeNudge />
      </>
    );

  return (
    <>
      {!modalOpen && (
        <ErrorBoundary fallback={(error, reset) => <CanvasFailure error={error} reset={reset} />}>
          <Canvas shadows dpr={dprCap} gl={{ antialias: true }}>
            <SceneRoot />
            <EffectComposer multisampling={composerMultisampling}>
              <Bloom
                intensity={0.28}
                luminanceThreshold={bloomThreshold}
                luminanceSmoothing={bloomSmoothing}
                mipmapBlur
                kernelSize={bloomKernel}
              />
            </EffectComposer>
          </Canvas>
        </ErrorBoundary>
      )}

      {screen === "worldMap" && !modalOpen && <WorldMapUI />}
      {screen !== "worldMap" && !modalOpen && <HUD />}
      {screen === "results" && !modalOpen && <ResultsScreen />}
      {compendiumOpen && (
        <Suspense fallback={null}>
          <Compendium />
        </Suspense>
      )}
      {achievementsOpen && (
        <Suspense fallback={null}>
          <AchievementsPanel />
        </Suspense>
      )}
      {creditsOpen && (
        <Suspense fallback={null}>
          <CreditsPanel />
        </Suspense>
      )}
      {difficultyPickerOpen && (
        <Suspense fallback={null}>
          <DifficultyPicker />
        </Suspense>
      )}
      {skillTreeOpen && (
        <Suspense fallback={null}>
          <SkillTreePanel />
        </Suspense>
      )}
      {heroShopOpen && (
        <Suspense fallback={null}>
          <HeroShop />
        </Suspense>
      )}
      {screen === "playing" && levelIntroVisible && <LevelIntro />}
      {screen === "playing" && !modalOpen && <NewEnemyAlert />}
      <AchievementToast />
      <LandscapeNudge />
    </>
  );
};
