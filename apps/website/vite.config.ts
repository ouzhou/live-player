import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 与 @live-player/core 的 package.json `exports.development` 对齐，开发时直连源码 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ["development", "browser", "module", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
