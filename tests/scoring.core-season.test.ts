import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { Destination, UserInput } from "@/lib/types";

// 테스트용 목적지 팩토리
const makeDest = (id: string, budget: 1|2|3|4|5, best: number[]): Destination => ({
  id, name: id.toUpperCase(), country: "T",
  region: "domestic",
  traitProfile: { social:.5, novelty:.5, structure:.5, flexibility:.5, sensory:.5, culture:.5 },
  elementProfile: { wood:.2, fire:.2, earth:.2, metal:.2, water:.2 },
  bestMonths: best, budgetLevel: budget, notes: [],
});

describe("스코어링 코어 — 예산 strict/fallback + 시즌 완충", () => {
  it("예산 strict: 같은 레벨만 남고 0건이면 fallback 동작", () => {
    const ds: Destination[] = [
      makeDest("A", 2, [4]),
      makeDest("B", 3, [4]),
      makeDest("C", 2, [1]),
    ];
    const input: UserInput = { mbti:"INTP", budgetLevel:2, region:"domestic", companions:"solo", travelMonth:4 };
    const res = recommend(input, { dataset: ds, limit: 10 });
    // 우선적으로 budget=2가 남음
    expect(res.every(r => r.destination.budgetLevel === 2)).toBe(true);
  });

  it("시즌 인접월(±1)은 완충되어 과도하게 밀리지 않는다", () => {
    const ds: Destination[] = [
      makeDest("BEST", 2, [4]), // 여행월=4 완벽 일치
      makeDest("NEAR", 2, [5]), // 인접월
    ];
    const input: UserInput = { mbti:"INTP", budgetLevel:2, region:"domestic", companions:"solo", travelMonth:4 };
    const res = recommend(input, { dataset: ds, limit: 10 });
    const best = res.find(r => r.destination.id === "BEST")!.score;
    const near = res.find(r => r.destination.id === "NEAR")!.score;
    expect(best).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(0); // 완충 효과
  });
});