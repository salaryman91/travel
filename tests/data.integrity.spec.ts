import { describe, it, expect } from "vitest";
import { destinations } from "@/data/destinations";
import type { Trait, Element } from "@/lib/types";

/**
 * in01
 * - 목적: 0~1 범위 정규화된 지표 검증 유틸
 * - 사용처: traitProfile/elementProfile 값 검증
 */
const in01 = (v: number) => v >= 0 && v <= 1;

describe("데이터 무결성 — 목적지 스키마/범위", () => {
  /**
   * 필수 필드 및 범위 검증
   * - 스키마 준수 여부(필수키 존재, 선택키 타입)와 대표 수치 범위를 점검한다.
   * - 주의: 데이터셋이 커져도 O(N) 선형 검사로 빠르게 실패 지점을 식별할 수 있다.
   */
  it("필수 필드 & 범위 체크", () => {
    for (const d of destinations) {
      // 필수 식별/표시 정보
      expect(Boolean(d.id && d.name && d.country)).toBe(true);

      // 지역 구분(열거형) — "domestic" | "overseas"
      expect(["domestic","overseas"]).toContain(d.region);

      // 예산 레벨(1~5)
      expect(d.budgetLevel).toBeGreaterThanOrEqual(1);
      expect(d.budgetLevel).toBeLessThanOrEqual(5);

      // 권장 방문 월(1~12)
      if (d.bestMonths) {
        for (const m of d.bestMonths) {
          expect(m).toBeGreaterThanOrEqual(1);
          expect(m).toBeLessThanOrEqual(12);
        }
      }

      // 성향 프로파일(0~1 정규화)
      if (d.traitProfile) {
        for (const k of Object.keys(d.traitProfile) as Trait[]) {
          expect(in01(d.traitProfile[k]!)).toBe(true);
        }
      }

      // 오행 프로파일(0~1 정규화)
      if (d.elementProfile) {
        for (const k of Object.keys(d.elementProfile) as Element[]) {
          expect(in01(d.elementProfile[k]!)).toBe(true);
        }
      }

      // 테마 태그는 배열/문자열 요소여야 함(선택 필드)
      if ((d as any).themes !== undefined) {
        expect(Array.isArray((d as any).themes)).toBe(true);
        for (const t of (d as any).themes) expect(typeof t).toBe("string");
      }

      // 동반 형태 선호 리스트는 배열이어야 함(선택 필드)
      if ((d as any).suitableFor !== undefined) {
        expect(Array.isArray((d as any).suitableFor)).toBe(true);
      }

      // 평균 비행시간(선택 필드) — 현실적 상한 24시간
      if (typeof (d as any).avgFlightHoursFromICN === "number") {
        expect((d as any).avgFlightHoursFromICN).toBeGreaterThanOrEqual(0);
        expect((d as any).avgFlightHoursFromICN).toBeLessThanOrEqual(24);
      }
    }
  });
});