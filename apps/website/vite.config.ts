import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Align with @live-player/core package.json `exports.development` — dev resolves package source directly. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ["development", "browser", "module", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
