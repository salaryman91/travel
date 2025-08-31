import { describe, it, expect } from "vitest";
import { destinations } from "@/data/destinations";

const inRange01 = (v: number) => v >= 0 && v <= 1;

describe("데이터 품질/무결성 (병합)", () => {
  it("필수 필드와 도메인 체크", () => {
    for (const d of destinations) {
      expect(d.id && d.name && d.country).toBeTruthy();
      expect(["domestic", "overseas"]).toContain(d.region);
      expect(d.budgetLevel).toBeGreaterThanOrEqual(1);
      expect(d.budgetLevel).toBeLessThanOrEqual(5);
      if (d.bestMonths) {
        for (const m of d.bestMonths) {
          expect(m).toBeGreaterThanOrEqual(1);
          expect(m).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it("Trait/Element 프로파일 값은 0~1 범위", () => {
    const traitKeys = ["social","novelty","structure","flexibility","sensory","culture"];
    const elemKeys  = ["wood","fire","earth","metal","water"];
    for (const d of destinations as any[]) {
      for (const [k, v] of Object.entries(d.traitProfile ?? {})) {
        expect(traitKeys).toContain(k);
        expect(inRange01(v as number)).toBe(true);
      }
      for (const [k, v] of Object.entries(d.elementProfile ?? {})) {
        expect(elemKeys).toContain(k);
        expect(inRange01(v as number)).toBe(true);
      }
    }
  });

  it("선택 지표(접근성/안전/언어/나이트라이프/그룹/코스트)는 0~1 (있을 경우)", () => {
    const keys = ["safetyIndex","accessEase","languageEase","nightlife","groupEase","costIndex"] as const;
    for (const d of destinations as any[]) {
      for (const k of keys) {
        const v = d[k];
        if (typeof v === "number") {
          expect(inRange01(v)).toBe(true);
        }
      }
    }
  });

  it("suitableFor 값 집합 / avgFlightHoursFromICN 범위 / themes 타입", () => {
    const ALLOWED = new Set(["solo","couple","friends","family"]);
    for (const d of destinations as any[]) {
      if (Array.isArray(d.suitableFor)) {
        for (const c of d.suitableFor) expect(ALLOWED.has(c)).toBe(true);
      }
      if (typeof d.avgFlightHoursFromICN === "number") {
        expect(d.avgFlightHoursFromICN).toBeGreaterThanOrEqual(0);
        expect(d.avgFlightHoursFromICN).toBeLessThanOrEqual(24);
      }
      if (d.themes !== undefined) {
        expect(Array.isArray(d.themes)).toBe(true);
        for (const t of d.themes) expect(typeof t).toBe("string");
      }
    }
  });
});