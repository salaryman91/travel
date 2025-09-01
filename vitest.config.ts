import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// 테스트에서 한국 시간대 고정 (사주/간지 월경계 영향 방지)
process.env.TZ = "Asia/Seoul";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // JSX 자동 런타임 (테스트 JSX에서 React import 없이도 동작)
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",                // ← UI 컴포넌트 테스트 필수
    globals: true,
    setupFiles: ["./tests/setup.ts"],    // ← jest-dom 매처 등록
    css: true,
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}", // spec/test + ts/tsx 모두 허용
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
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