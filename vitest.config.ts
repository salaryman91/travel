import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// 날짜/시각 계산 일관성 보장을 위해 테스트 타임존을 한국(KST)으로 고정
// (사주 간지 계산 시 월경계/시지에 영향)
process.env.TZ = "Asia/Seoul";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 0.75,
        functions: 0.70,
        branches: 0.60,
        statements: 0.75,
      },
    },
  },
});