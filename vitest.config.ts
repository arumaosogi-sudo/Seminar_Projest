import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone on purpose: it must NOT load vite.config.ts — the cloudflare() plugin starts workerd and breaks vitest
// ("There is already a server associated with the config"). Tests cover pure logic only (worker + src helpers).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["worker/**/*.test.ts", "src/**/*.test.ts"],
  },
});
