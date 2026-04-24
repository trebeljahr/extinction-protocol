import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 3286,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
