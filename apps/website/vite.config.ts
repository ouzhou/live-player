import { defineConfig } from "vite-plus";

/** 与 @live-player/core 的 package.json `exports.development` 对齐，开发时直连源码 */
export default defineConfig({
  resolve: {
    conditions: ["development", "browser", "module", "import", "default"],
  },
});
