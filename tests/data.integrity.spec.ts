import { describe, it, expect } from "vitest";
import { destinations } from "@/data/destinations";
import type { Trait, Element } from "@/lib/types";

const in01 = (v: number) => v >= 0 && v <= 1;

describe("데이터 무결성 — 목적지 스키마/범위", () => {
  it("필수 필드 & 범위 체크", () => {
    for (const d of destinations) {
      expect(Boolean(d.id && d.name && d.country)).toBe(true);
      expect(["domestic","overseas"]).toContain(d.region);
      expect(d.budgetLevel).toBeGreaterThanOrEqual(1);
      expect(d.budgetLevel).toBeLessThanOrEqual(5);

      if (d.bestMonths) {
        for (const m of d.bestMonths) {
          expect(m).toBeGreaterThanOrEqual(1);
          expect(m).toBeLessThanOrEqual(12);
        }
      }

      if (d.traitProfile) {
        for (const k of Object.keys(d.traitProfile) as Trait[]) {
          expect(in01(d.traitProfile[k]!)).toBe(true);
        }
      }
      if (d.elementProfile) {
        for (const k of Object.keys(d.elementProfile) as Element[]) {
          expect(in01(d.elementProfile[k]!)).toBe(true);
        }
      }

      if ((d as any).themes !== undefined) {
        expect(Array.isArray((d as any).themes)).toBe(true);
        for (const t of (d as any).themes) expect(typeof t).toBe("string");
      }
      if ((d as any).suitableFor !== undefined) {
        expect(Array.isArray((d as any).suitableFor)).toBe(true);
      }
      if (typeof (d as any).avgFlightHoursFromICN === "number") {
        expect((d as any).avgFlightHoursFromICN).toBeGreaterThanOrEqual(0);
        expect((d as any).avgFlightHoursFromICN).toBeLessThanOrEqual(24);
      }
    }
  });
});