import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createLogger, defineConfig, loadEnv, type PluginOption } from "vite";

const DEV_PORT = 3286;
const HATCHKIT_VITE_PLUGIN = "@hatchkit/dev-plugin-vite";
const SOURCEMAP_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const PHYSICS_CHUNK_PACKAGES = [
  "/node_modules/@dimforge/",
  "/node_modules/@react-three/rapier/",
  "/node_modules/three-bvh-csg/",
  "/node_modules/three-mesh-bvh/",
];
const THREE_CHUNK_PACKAGES = [
  "/node_modules/@react-three/",
  "/node_modules/@react-spring/three/",
  "/node_modules/@monogrid/gainmap-js/",
  "/node_modules/camera-controls/",
  "/node_modules/detect-gpu/",
  "/node_modules/glsl-noise/",
  "/node_modules/maath/",
  "/node_modules/meshline/",
  "/node_modules/n8ao/",
  "/node_modules/postprocessing/",
  "/node_modules/stats-gl/",
  "/node_modules/three/",
  "/node_modules/three-stdlib/",
  "/node_modules/troika-three-text/",
  "/node_modules/troika-three-utils/",
];
const UI_HEAVY_CHUNK_PACKAGES = [
  "/node_modules/react/",
  "/node_modules/react-dom/",
  "/node_modules/react-reconciler/",
  "/node_modules/scheduler/",
  "/node_modules/use-sync-external-store/",
  "/node_modules/zustand/",
];

type HatchkitViteModule = {
  localDev?: (options: { slug: string }) => PluginOption;
};

type BuildSourcemap = boolean | "hidden" | "inline";

const getBuildSourcemap = (value?: string): BuildSourcemap => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "hidden" || normalized === "inline") {
    return normalized;
  }

  return SOURCEMAP_TRUE_VALUES.has(normalized ?? "");
};

const matchesAnyPackage = (id: string, packages: string[]) =>
  packages.some((packagePath) => id.includes(packagePath));

const manualChunks = (id: string): string | undefined => {
  const normalizedId = id.replaceAll("\\", "/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (matchesAnyPackage(normalizedId, PHYSICS_CHUNK_PACKAGES)) {
    return "physics";
  }

  if (matchesAnyPackage(normalizedId, THREE_CHUNK_PACKAGES)) {
    return "three";
  }

  if (matchesAnyPackage(normalizedId, UI_HEAVY_CHUNK_PACKAGES)) {
    return "ui-heavy";
  }

  return "vendor";
};

const loadHatchkitLocalDev = async (): Promise<PluginOption[]> => {
  try {
    const { localDev } = (await import(HATCHKIT_VITE_PLUGIN)) as HatchkitViteModule;
    return typeof localDev === "function" ? [localDev({ slug: "mesozoic-protocol" })] : [];
  } catch (error) {
    console.warn(
      `Skipping Hatchkit local-dev Vite plugin: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
};

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, ".", "");
  const plausibleDomain = env.VITE_PLAUSIBLE_DOMAIN ?? "protocol.trebeljahr.com";
  const plausibleScriptUrl =
    env.VITE_PLAUSIBLE_SCRIPT_URL ??
    "https://plausible.trebeljahr.com/js/script.file-downloads.hash.outbound-links.pageview-props.revenue.tagged-events.js";
  // Host-gated: the marker injects a loader, but it only appends the
  // Plausible script when the current hostname matches the configured
  // production domain.
  // The inline shim queues track() calls fired before the deferred
  // script attaches, so callers don't need to wait for load.
  // Build SHA injected into index.html as a `<meta>` tag so prod
  // can be curl-verified (`curl … | grep build-sha`). Fed by the
  // deploy workflow via `--build-arg VITE_BUILD_SHA=$GITHUB_SHA`,
  // surfaced to Vite through the matching `ENV VITE_BUILD_SHA` in
  // the Dockerfile. Falls back to "dev" for local builds.
  const buildSha = env.VITE_BUILD_SHA ?? "dev";
  const buildSourcemap = getBuildSourcemap(env.BUILD_SOURCEMAP ?? env.VITE_BUILD_SOURCEMAP);
  const buildShaTag = `<meta name="build-sha" content="${buildSha}" />`;
  const plausibleTag = plausibleDomain
    ? `<script>
      (function () {
        var domain = ${JSON.stringify(plausibleDomain)};
        if (location.hostname !== domain) return;
        window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};
        var script=document.createElement("script");
        script.defer=true;
        script.dataset.domain=domain;
        script.src=${JSON.stringify(plausibleScriptUrl)};
        document.head.appendChild(script);
      })();
    </script>`
    : "";
  const hatchkitPlugins =
    command === "serve" && env.HATCHKIT_LOCAL_DEV !== "0" ? await loadHatchkitLocalDev() : [];

  // Quiet logger for dev: silence routine HMR chatter (hmr update,
  // hmr invalidate, page reload) so the terminal stays clean. Warnings
  // and errors still print — those go through warn/error, not info.
  const quietLogger = createLogger();
  const baseInfo = quietLogger.info.bind(quietLogger);
  const HMR_NOISE = /\b(hmr update|hmr invalidate|page reload)\b/;
  quietLogger.info = (msg, opts) => {
    if (typeof msg === "string") {
      if (HMR_NOISE.test(msg)) return;
    }
    baseInfo(msg, opts);
  };

  // Re-add the Network: <tailscale/LAN IP> banner that the hatchkit
  // plugin strips. Wraps `server.printUrls` after hatchkit's override
  // so we still get Local (vite) → Network (this) → Tailscale (hatchkit,
  // async). Loaded only on `vite` (serve), pass-through on build.
  const networkUrlsPlugin: PluginOption = {
    name: "print-network-urls",
    apply: "serve",
    configureServer(server) {
      const wrapped = server.printUrls.bind(server);
      server.printUrls = () => {
        wrapped();
        const network = server.resolvedUrls?.network ?? [];
        for (const url of network) {
          server.config.logger.info(
            `  \x1b[32m➜\x1b[0m  \x1b[1mNetwork\x1b[0m: \x1b[36m${url}\x1b[0m`,
          );
        }
      };
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "plausible-html",
        transformIndexHtml(html: string) {
          return html
            .replace("<!--BUILD-SHA-->", buildShaTag)
            .replace("<!--PLAUSIBLE-->", plausibleTag);
        },
      },
      // Tailscale-served dev URL via host-wide Caddy + tailscale serve
      // TCP=443. Writes ~/.config/dev/projects/mesozoic-protocol.caddy
      // on dev startup, replaces Vite's Local/Network banner with
      // Local/Tailscale. Set `HATCHKIT_LOCAL_DEV=0` in env to disable.
      // Host plumbing is the host's `hatchkit dev-setup init` job.
      ...hatchkitPlugins,
      networkUrlsPlugin,
    ] as PluginOption[],
    clearScreen: false,
    customLogger: command === "serve" ? quietLogger : undefined,
    server: {
      port: DEV_PORT,
      strictPort: true,
      watch: {
        // Other Claude Code worktrees live under `.claude/worktrees/*`
        // and trigger spurious `page reload` + `changed tsconfig`
        // full-reloads in this main dev server whenever any agent
        // edits its own copy. Ignore everything under there.
        ignored: ["**/.claude/worktrees/**"],
      },
      // Bind to all interfaces so LAN + Tailscale peers can hit the dev
      // server by IP / MagicDNS hostname. `--host` on the CLI flips the
      // same switch.
      host: true,
      // Vite 5+ rejects requests whose Host header doesn't match
      // localhost. Without an explicit allow-list mobile testing hits 403
      // on every asset (incl. /models/*.glb), which crashes the r3f scene
      // with "Cannot read properties of undefined (reading 'max')" out of
      // useGLTF -> meshSource.
      //
      // Vite auto-allows: any IPv4/IPv6 literal, `localhost`, and
      // `*.localhost`. So plain-IP testing on the LAN / tailnet works
      // without entries here. We only need to whitelist named hosts:
      //   - `.local.ricoslabs.com` — hatchkit local-dev URLs (Caddy + tailscale serve).
      //   - `.ts.net` — Tailscale MagicDNS hostnames (direct, no Caddy).
      //   - `.local`  — mDNS hostnames (e.g. macbook.local) for plain LAN.
      // Production builds never read this field.
      allowedHosts: [".local.ricoslabs.com", ".ts.net", ".local"],
    },
    build: {
      target: "es2022",
      sourcemap: buildSourcemap,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  };
});
