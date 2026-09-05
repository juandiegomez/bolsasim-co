import { defineConfig } from "vitest/config";

const shared = {
  resolve: { tsconfigPaths: true },
  test: { environment: "node" as const, setupFiles: ["./tests/setup.ts"] },
};

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 20000,
          hookTimeout: 20000,
          fileParallelism: false,
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: "contract",
          include: ["tests/contract/**/*.test.ts"],
        },
      },
    ],
  },
});
