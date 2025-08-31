import { describe, it, expect } from "vitest";
import { destinations } from "@/data/destinations";
import type { Trait, Element } from "@/lib/types";

describe("destinations data integrity", () => {
  it("필수 필드와 값 범위를 만족한다", () => {
    const traits: Trait[] = ["social", "novelty", "structure", "flexibility", "sensory", "culture"];
    const elems: Element[] = ["wood", "fire", "earth", "metal", "water"];

    for (const d of destinations) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(["domestic", "overseas"]).toContain(d.region);

      // budgetLevel: 1~5 정수
      expect(Number.isInteger(d.budgetLevel)).toBe(true);
      expect(d.budgetLevel).toBeGreaterThanOrEqual(1);
      expect(d.budgetLevel).toBeLessThanOrEqual(5);

      // trait / element 키·값 검증
      for (const t of traits) expect(typeof d.traitProfile[t] === "number").toBe(true);
      for (const e of elems) expect(typeof d.elementProfile[e] === "number").toBe(true);
    }
  });
});