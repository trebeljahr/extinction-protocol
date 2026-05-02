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
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});
