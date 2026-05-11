import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

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
    ],
    clearScreen: false,
    server: {
      port: 3286,
      strictPort: true,
      // Bind to all interfaces so LAN devices (phone/tablet) can hit the
      // dev server by IP. `--host` on the CLI flips the same switch.
      host: true,
      // Vite 5+ rejects requests whose Host header doesn't match localhost,
      // returning 403 for every asset (incl. /models/*.glb). Without this
      // mobile testing on the LAN sees broken GLBs, which then crash the
      // r3f scene with "Cannot read properties of undefined (reading 'max')"
      // out of useGLTF -> meshSource. Allow the typical LAN ranges + *.local
      // mDNS names; production builds never read this field.
      allowedHosts: ["192.168.1.*", "192.168.0.*", "10.0.0.*", "*.local", "localhost"],
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});
