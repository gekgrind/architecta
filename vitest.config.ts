import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // `@/x` path alias (mirrors tsconfig "paths").
      { find: /^@\//, replacement: `${resolve(__dirname)}/` },
      // `server-only` throws outside a React Server Component; stub it in tests.
      { find: /^server-only$/, replacement: resolve(__dirname, "test/server-only-stub.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    clearMocks: true,
  },
});
