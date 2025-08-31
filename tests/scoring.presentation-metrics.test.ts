import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { Destination, UserInput } from "@/lib/types";

const makeDest = (id: string, budget: 1|2|3|4|5, tp: Partial<Destination["traitProfile"]> = {}, extra: Partial<Destination> = {}): Destination => ({
  id, name: id.toUpperCase(), country: extra.country ?? "X",
  region: (extra.region as any) ?? "overseas",
  traitProfile: { social:.5, novelty:.5, structure:.5, flexibility:.5, sensory:.5, culture:.5, ...(tp as any) },
  elementProfile: { wood:.2, fire:.2, earth:.2, metal:.2, water:.2 },
  bestMonths: extra.bestMonths ?? [10],
  budgetLevel: budget,
  notes: [],
  ...extra,
});

describe("프레젠테이션 메트릭(tier/share/percentile) + 필터", () => {
  const baseInput: UserInput = {
    mbti: "INTP",
    region: "overseas",
    companions: "solo",
    budgetLevel: 2,
    travelMonth: 10,
    birthDate: "1991-01-18",
  };

  it("최상위 항목은 tier=S 이고 share는 0~1 사이", () => {
    const ds = [
      makeDest("TOP", 2, { structure:.9, culture:.8 }, { country:"A" }),
      makeDest("MID", 2, { structure:.6 }, { country:"B" }),
      makeDest("LOW", 2, { structure:.1 }, { country:"C" }),
    ];
    const res = recommend(baseInput, { dataset: ds, limit: 5 });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].tier).toBe("S");
    expect(res[0].share).toBeGreaterThan(0);
    expect(res[0].share).toBeLessThanOrEqual(1);
    // 정렬 단조성(share는 score에 단조증가)
    for (let i=1;i<res.length;i++){
      expect(res[i-1].share).toBeGreaterThanOrEqual(res[i].share);
    }
  });

  it("극단적 저적합(과도한 예산 초과)은 필터되어 미노출", () => {
    const ds = [
      makeDest("GOOD", 2, { structure:.9 }, { country:"A" }),
      // 예산 5 vs 요청 1 → penalty가 커서 음수/매우 낮은 scoreRaw 유도
      makeDest("OVERPRICE", 5, { structure:.1 }, { country:"B" }),
    ];
    const res = recommend({ ...baseInput, budgetLevel: 1 }, { dataset: ds, limit: 5 });
    const ids = res.map(r => r.destination.id);
    expect(ids).toContain("GOOD");
    expect(ids).not.toContain("OVERPRICE"); // 필터링 통과 못함
  });
});