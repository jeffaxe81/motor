import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    coverage: {
      enabled: false
    }
  }
});
