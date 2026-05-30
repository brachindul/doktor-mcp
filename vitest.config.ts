import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/benchmark/doctorQuestions.ts",
        "src/benchmark/realWorldPhysicianQuestions.ts",
        "src/**/__mocks__/**",
      ],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
});
