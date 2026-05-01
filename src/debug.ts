// Debug mode — enabled only in dev builds AND when the URL has
// `?debug=true`. The pattern matches raptor-runner: gate on
// `import.meta.env.DEV` so Vite/Rollup dead-code-eliminate the entire
// debug surface in production. Adding `?debug=true` to a deployed
// build does nothing.
//
// Components read `isDebug` to decide whether to render their debug
// section, and CSS can target `body[data-debug="true"]` for finer
// gating (e.g. show-on-hover toggles).
//
// All runtime mutations live as store actions (see store.ts:
// debug*). This module only owns the URL gate + body attribute.

const readDebugParam = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "true";
  } catch {
    return false;
  }
};

// `import.meta.env.DEV` is replaced statically at build time, so this
// constant collapses to `false && ...` in production and the entire
// debug branch dead-codes out.
export const isDebug: boolean = import.meta.env.DEV === true && readDebugParam();

if (isDebug && typeof document !== "undefined") {
  document.body.setAttribute("data-debug", "true");
}

// In debug mode, expose the Zustand store on window so quick console
// repros (or preview eval) can drive level selection without clicking
// through the world map. Production builds dead-code this since
// `isDebug` is gated on `import.meta.env.DEV`.
if (isDebug && typeof window !== "undefined") {
  // Lazy require to avoid a circular import at module init time.
  import("./store").then(({ useGame }) => {
    (window as unknown as { __game: unknown }).__game = useGame;
  });
}
