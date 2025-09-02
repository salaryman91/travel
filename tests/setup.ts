/**
 * tests/setup.ts
 * - Vitest 전역 테스트 환경 사전 설정 파일
 *
 * 목적
 * - @testing-library/jest-dom의 커스텀 DOM 매처(예: toBeDisabled, toHaveTextContent 등)를
 *   Vitest 환경에 전역 등록한다. 각 테스트 파일에서 반복 임포트가 필요 없다.
 *
 * 사용 방법
 * - vitest 설정에 setupFiles로 본 파일을 지정한다.
 *
 *   // vitest.config.ts (예시)
 *   import { defineConfig } from "vitest/config";
 *   export default defineConfig({
 *     test: {
 *       environment: "jsdom",              // DOM 매처 사용을 위해 jsdom 환경 권장
 *       setupFiles: ["./tests/setup.ts"],  // 본 파일 등록
 *     },
 *   });
 *
 * 참고
 * - 이 파일은 실행 시 전역 expect에 매처를 확장하는 부작용만 수행하므로 export가 없다.
 * - 공통 훅/모킹(예: MSW 서버 시작/정지) 등이 필요하면 이 파일에 추가한다.
 */
import "@testing-library/jest-dom/vitest"; // DOM 매처 등록: toBeDisabled, toBeInTheDocument 등