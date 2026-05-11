import { execFile } from "node:child_process";
import { promisify } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const execFileAsync = promisify(execFile);

// Resolve the Tailscale identity of this machine (MagicDNS short name,
// full tailnet hostname, tailnet IP, and node ID for the serve-enable
// URL). Best-effort — silently returns null if `tailscale` is missing
// or the daemon is off.
type TailscaleIdentity = {
  shortName: string;
  fullName: string;
  ip: string;
  nodeId: string | null;
};

const tailscaleIdentity = async (): Promise<TailscaleIdentity | null> => {
  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"], {
      timeout: 1500,
    });
    const json = JSON.parse(stdout) as {
      Self?: { DNSName?: string; TailscaleIPs?: string[]; ID?: string };
    };
    const self = json.Self;
    if (!self?.DNSName || !self.TailscaleIPs?.length) return null;
    const fullName = self.DNSName.replace(/\.$/, "");
    const shortName = fullName.split(".")[0] ?? fullName;
    const ip = self.TailscaleIPs.find((v) => /^\d+\.\d+\.\d+\.\d+$/.test(v)) ?? "";
    if (!ip) return null;
    return { shortName, fullName, ip, nodeId: self.ID ?? null };
  } catch {
    return null;
  }
};

// Probe `tailscale serve status` to see whether the given local port has
// an active HTTPS bridge into the tailnet. macOS App Store Tailscale uses
// the NetworkExtension framework, which means peers CANNOT reach raw TCP
// ports on the tailnet IP — `tailscale serve` is the only working path.
// Returns the public HTTPS URL when a bridge exists, otherwise null.
const tailscaleServeBridgeUrl = async (localPort: number): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("tailscale", ["serve", "status", "--json"], {
      timeout: 1500,
    });
    const cfg = JSON.parse(stdout) as {
      Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }>;
    };
    if (!cfg.Web) return null;
    for (const [hostport, web] of Object.entries(cfg.Web)) {
      const handlers = web.Handlers ?? {};
      for (const handler of Object.values(handlers)) {
        if (handler.Proxy?.includes(`:${localPort}`)) {
          const [host, port] = hostport.split(":");
          const suffix = port === "443" ? "" : `:${port}`;
          return `https://${host}${suffix}/`;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Register a tailscale serve bridge for `localPort`. The serve config
// lives in tailscaled (persistent across vite restarts), so subsequent
// dev runs see the bridge via tailscaleServeBridgeUrl without re-running.
// Returns a tagged result so the banner can format the right message.
type ServeRegisterResult =
  | { kind: "ok" }
  | { kind: "needsEnable"; enableUrl: string | null }
  | { kind: "tailscaleMissing" }
  | { kind: "other"; message: string };

const tailscaleEnsureServe = async (
  localPort: number,
  nodeId: string | null,
): Promise<ServeRegisterResult> => {
  try {
    await execFileAsync(
      "tailscale",
      ["serve", "--bg", "--https=443", `http://localhost:${localPort}`],
      { timeout: 8000 },
    );
    return { kind: "ok" };
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") return { kind: "tailscaleMissing" };
    if (stderr.includes("Serve is not enabled") || stderr.includes("HTTPS is not enabled")) {
      const enableUrl = nodeId ? `https://login.tailscale.com/f/serve?node=${nodeId}` : null;
      return { kind: "needsEnable", enableUrl };
    }
    return { kind: "other", message: stderr.split("\n")[0] || "unknown error" };
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
      // Tailscale state is async; fire-and-forget so banner appends after
      // the Local line. Best-effort — silently no-ops if tailscale isn't
      // installed or the daemon is offline.
      //
      // macOS App Store Tailscale runs through a NetworkExtension which
      // means peers can't reach raw TCP on the tailnet IP — you must
      // bridge via `tailscale serve`. We probe its state and, if no
      // bridge exists, register one automatically. Opt out by setting
      // `VITE_AUTO_TAILSCALE_SERVE=0` in the environment.
      void (async () => {
        const id = await tailscaleIdentity();
        if (!id) return;
        const addr = server.httpServer?.address();
        const port = typeof addr === "object" && addr ? addr.port : null;
        if (port === null) return;
        const label = (text: string) => `\x1b[1mTailscale\x1b[0m: ${text}`;
        const printActive = (url: string) =>
          info(`  \x1b[32m➜\x1b[0m  ${label(`\x1b[36m${url}\x1b[0m`)}`);

        const existing = await tailscaleServeBridgeUrl(port);
        if (existing) {
          printActive(existing);
          return;
        }
        const autoOff = process.env.VITE_AUTO_TAILSCALE_SERVE === "0";
        if (autoOff) {
          info(`  \x1b[33m➜\x1b[0m  ${label("No serve bridge (auto-serve disabled).")}`);
          info(
            `       Run: \x1b[2mtailscale serve --bg --https=443 http://localhost:${port}\x1b[0m`,
          );
          return;
        }
        info(`  \x1b[2m➜  Tailscale: registering serve bridge…\x1b[0m`);
        const result = await tailscaleEnsureServe(port, id.nodeId);
        if (result.kind === "ok") {
          const after = await tailscaleServeBridgeUrl(port);
          if (after) {
            printActive(after);
            return;
          }
          printActive(`https://${id.fullName}/`);
          return;
        }
        if (result.kind === "needsEnable") {
          info(`  \x1b[33m➜\x1b[0m  ${label("Serve / HTTPS not enabled on this tailnet.")}`);
          if (result.enableUrl) {
            info(`       Enable once: \x1b[36m${result.enableUrl}\x1b[0m`);
          }
          info(`       Also enable HTTPS certs in DNS settings, then restart \`pnpm dev\`.`);
          return;
        }
        if (result.kind === "tailscaleMissing") {
          // Daemon was reachable for `status` but not the CLI subprocess —
          // weird, but treat as silent no-op rather than scaring the user.
          return;
        }
        info(`  \x1b[33m➜\x1b[0m  ${label(`Serve register failed: ${result.message}`)}`);
        info(
          `       Run manually: \x1b[2mtailscale serve --bg --https=443 http://localhost:${port}\x1b[0m`,
        );
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
