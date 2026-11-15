import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@config": path.resolve(import.meta.dirname, "config"),
    },
  },
  test: {
    environment: "node",
    // Los tests de base de datos comparten una base: corren de a uno.
    fileParallelism: false,
  },
});
