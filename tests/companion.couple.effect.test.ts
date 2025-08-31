import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import { destinations } from "@/data/destinations";
import type { UserInput } from "@/lib/types";

describe("동반형태 — couple 가점은 과하지 않게, 최소 손해 없음", () => {
  const tokyo = destinations.find(d => /(도쿄|Tokyo)/i.test(d.name));

  it("nightlife/도시 적합도가 높은 목적지는 couple에서 소폭 유리(또는 최소 손해 없음)", () => {
    if (!tokyo) return; // 데이터 변경에 안전하게
    const base: UserInput = {
      mbti: "INFJ",
      region: "overseas",
      companions: "solo",
      budgetLevel: tokyo!.budgetLevel as any,
      travelMonth: 10,
      birthDate: "1993-05-10",
    };
    const solo = recommend({ ...base }, { limit: 200 });
    const coup = recommend({ ...base, companions: "couple" }, { limit: 200 });
    const score = (arr: ReturnType<typeof recommend>) =>
      arr.find(x => x.destination.id === tokyo!.id)?.score ?? 0;
    const diff = score(coup) - score(solo);
    expect(diff).toBeGreaterThanOrEqual(-0.01);
    expect(diff).toBeLessThanOrEqual(0.20);
  });
});