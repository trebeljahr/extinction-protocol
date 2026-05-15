import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";

const DEV_PORT = 3286;
const HATCHKIT_VITE_PLUGIN = "@hatchkit/dev-plugin-vite";

type HatchkitViteModule = {
  localDev?: (options: { slug: string }) => PluginOption;
};

const loadHatchkitLocalDev = async (): Promise<PluginOption[]> => {
  try {
    const { localDev } = (await import(HATCHKIT_VITE_PLUGIN)) as HatchkitViteModule;
    return typeof localDev === "function" ? [localDev({ slug: "extinction-protocol" })] : [];
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
          return html.replace("<!--PLAUSIBLE-->", plausibleTag);
        },
      },
      // Tailscale-served dev URL via host-wide Caddy + tailscale serve
      // TCP=443. Writes ~/.config/dev/projects/extinction-protocol.caddy
      // on dev startup, replaces Vite's Local/Network banner with
      // Local/Tailscale. Set `HATCHKIT_LOCAL_DEV=0` in env to disable.
      // Host plumbing is the host's `hatchkit dev-setup init` job.
      ...hatchkitPlugins,
      networkUrlsPlugin,
    ] as PluginOption[],
    clearScreen: false,
    server: {
      port: DEV_PORT,
      strictPort: true,
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
      sourcemap: true,
    },
  };
});
