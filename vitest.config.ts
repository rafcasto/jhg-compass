import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig uses jsx:preserve for Next; tests need the automatic runtime.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
