import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { Destination, UserInput } from "@/lib/types";

// 미니 데이터셋(테스트 주입용)
const makeDest = (id: string, budget: 1|2|3|4|5, best: number[]) : Destination => ({
  id, name: id.toUpperCase(), country: "T",
  region: "domestic",
  traitProfile: { social:.5, novelty:.5, structure:.5, flexibility:.5, sensory:.5, culture:.5 },
  elementProfile: { wood:.2, fire:.2, earth:.2, metal:.2, water:.2 },
  bestMonths: best, budgetLevel: budget, notes: [],
});

describe("스코어링 코어 (strict + fallback + 시즌 완충)", () => {
  it("예산 strict: 같은 레벨만 남고, 0건이면 fallback 동작", () => {
    const ds: Destination[] = [
      makeDest("A", 2, [5]), // band 후보
      makeDest("B", 3, [5]), // band/cap 후보
    ];
    // strict에서 level=5는 0건 → fallback으로 band(±1) 시도 → cap(+1) 시도 → 결국 B는 cap에 걸리지 않지만 bandGlobal/capGlobal 로 최소 1건 확보
    const input: UserInput = { mbti: "INTP", budgetLevel: 5, region: "domestic", companions: "solo", travelMonth: 5 };
    const res = recommend(input, { dataset: ds, limit: 10 });
    expect(res.length).toBeGreaterThan(0);
  });

  it("시즌 인접월(±1)은 페널티가 완충되어 순위가 과하게 밀리지 않는다", () => {
    const ds: Destination[] = [
      makeDest("BEST", 2, [4]), // 여행월=4인 경우 완벽 일치
      makeDest("NEAR", 2, [5]), // 인접월
    ];
    const input: UserInput = { mbti: "INTP", budgetLevel: 2, region: "domestic", companions: "solo", travelMonth: 4 };
    const res = recommend(input, { dataset: ds, limit: 10 });
    const best = res.find(r => r.destination.id === "BEST")!.score;
    const near = res.find(r => r.destination.id === "NEAR")!.score;
    expect(best).toBeGreaterThan(near);
    // 인접월이 극단적으로 낮지는 않음(완충 0.15)
    expect(near).toBeGreaterThan(0);
  });
});