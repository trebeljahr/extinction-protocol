import { localDev } from "@hatchkit/dev-plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEV_PORT = 3286;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const plausibleDomain = env.VITE_PLAUSIBLE_DOMAIN;
  // Env-gated: when VITE_PLAUSIBLE_DOMAIN is unset, the marker is
  // replaced with an empty string and no Plausible script is loaded.
  // The inline shim queues track() calls fired before the deferred
  // script attaches, so callers don't need to wait for load.
  const plausibleTag = plausibleDomain
    ? `<script defer data-domain="${plausibleDomain}" src="https://plausible.io/js/script.js"></script>
    <script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>`
    : "";
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
      localDev({ slug: "extinction-protocol" }),
    ],
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
