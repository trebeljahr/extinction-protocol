import { execFile } from "node:child_process";
import { promisify } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const execFileAsync = promisify(execFile);

// Resolve the Tailscale identity of this machine (MagicDNS short name,
// full tailnet hostname, and tailnet IP) so the dev banner can print
// the URLs a phone on the same tailnet should open. Best-effort —
// silently returns null if `tailscale` is missing or the daemon is off.
type TailscaleIdentity = {
  shortName: string;
  fullName: string;
  ip: string;
};

const tailscaleIdentity = async (): Promise<TailscaleIdentity | null> => {
  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"], {
      timeout: 1500,
    });
    const json = JSON.parse(stdout) as {
      Self?: { DNSName?: string; TailscaleIPs?: string[] };
    };
    const self = json.Self;
    if (!self?.DNSName || !self.TailscaleIPs?.length) return null;
    const fullName = self.DNSName.replace(/\.$/, "");
    const shortName = fullName.split(".")[0] ?? fullName;
    const ip = self.TailscaleIPs.find((v) => /^\d+\.\d+\.\d+\.\d+$/.test(v)) ?? "";
    if (!ip) return null;
    return { shortName, fullName, ip };
  } catch {
    return null;
  }
};

// Replace Vite's default `Local / Network` URL list with `Local / Tailscale`.
// Reasoning: the LAN-IP Network URLs are noise — they're rarely useful, and
// when they are useful, they collide with the Tailscale entries we'd rather
// have the user see. We keep Local for desktop dev, then show Tailscale short
// name + full MagicDNS + tailnet IP for phone testing.
//
// We override `server.printUrls` instead of filtering logger output so the
// `--host`-not-set hint case is also suppressed cleanly.
const tailscaleBanner = (): Plugin => ({
  name: "tailscale-banner",
  apply: "serve",
  configureServer(server) {
    const originalPrintUrls = server.printUrls.bind(server);
    server.printUrls = () => {
      const info = server.config.logger.info;
      const resolved = server.resolvedUrls;
      // resolvedUrls is null when the host check rejected every binding —
      // fall back to Vite's own printer in that edge case rather than going
      // silent.
      if (!resolved) {
        originalPrintUrls();
        return;
      }
      for (const url of resolved.local) {
        info(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal\x1b[0m:   \x1b[36m${url}\x1b[0m`);
      }
      // Tailscale identity is async; fire-and-forget so it appends after
      // the Local line. Banner is best-effort — silently no-ops if tailscale
      // isn't installed or the daemon is offline.
      void (async () => {
        const id = await tailscaleIdentity();
        if (!id) return;
        const addr = server.httpServer?.address();
        const port = typeof addr === "object" && addr ? addr.port : null;
        if (port === null) return;
        const urls = [
          `http://${id.shortName}:${port}/`,
          `http://${id.fullName}:${port}/`,
          `http://${id.ip}:${port}/`,
        ];
        for (const url of urls) {
          info(`  \x1b[32m➜\x1b[0m  \x1b[1mTailscale\x1b[0m: \x1b[36m${url}\x1b[0m`);
        }
      })();
    };
  },
});

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
      tailscaleBanner(),
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
      //   - `.ts.net`  — Tailscale MagicDNS hostnames (preferred path,
      //                  encrypted + auth'd via tailnet).
      //   - `.local`   — mDNS hostnames (e.g. macbook.local) for plain
      //                  LAN testing when Tailscale isn't an option.
      // Production builds never read this field.
      allowedHosts: [".ts.net", ".local"],
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});
