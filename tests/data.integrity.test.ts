import { describe, it, expect } from "vitest";
import { destinations } from "@/data/destinations";

const in01 = (v: number) => v >= 0 && v <= 1;

describe("데이터 품질/무결성 (통합)", () => {
  it("필수 필드/도메인/범위 체크", () => {
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
      // trait/element 0~1
      for (const [, v] of Object.entries(d.traitProfile ?? {})) {
        expect(in01(v as number)).toBe(true);
      }
      for (const [, v] of Object.entries(d.elementProfile ?? {})) {
        expect(in01(v as number)).toBe(true);
      }
    }
  });

  it("옵셔널 필드 — 허용 범위/타입", () => {
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