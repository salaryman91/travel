import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { UserInput, BudgetLevel, Companion, MBTI } from "@/lib/types";

const MBTIS: MBTI[] = [
  "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP",
];
const COMPANIONS: Companion[] = ["solo","couple","friends","family"];
const BUDGETS: BudgetLevel[] = [1,2,3,4,5] as BudgetLevel[];

function top1Id(input: UserInput): string | undefined {
  const r = recommend(input, { limit: 1 })[0];
  return r?.destination.id;
}

describe("추천 다양성(Variety) 시나리오 (통합)", () => {
  it("국내 UI 복제 — MBTI만 바뀌어도 Top1이 다양해야 한다(모든 동반형태)", () => {
    for (const c of COMPANIONS) {
      const ids = new Set<string>();
      for (const m of MBTIS) {
        const id = top1Id({ mbti:m, region:"domestic", companions:c, budgetLevel:2, travelMonth:4 } as UserInput);
        if (id) ids.add(id);
      }
      expect(ids.size).toBeGreaterThanOrEqual(2);
      if (ids.size === 1) console.warn("[variety:domestic] locked:", c, [...ids][0]);
    }
  });

  it("월만 바뀌어도 Top1이 다양해야 한다 (친구, all, budget=2)", () => {
    const ids = new Set<string>();
    for (let month=1 as const; month<=12; month++) {
      const id = top1Id({ mbti:"ENFP", region:"all", companions:"friends", budgetLevel:2, travelMonth:month } as UserInput);
      if (id) ids.add(id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(2);
    if (ids.size === 1) console.warn("[variety:month] locked:", [...ids][0]);
  });

  it("예산(1~5)만 바뀌어도 Top1이 다양해야 한다 (커플, 해외, 10월)", () => {
    const ids = new Set<string>();
    for (const b of BUDGETS) {
      const id = top1Id({ mbti:"ISTJ", region:"overseas", companions:"couple", budgetLevel:b, travelMonth:10 } as UserInput);
      if (id) ids.add(id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(2);
    if (ids.size === 1) console.warn("[variety:budget] locked:", [...ids][0]);
  });

  it("실데이터 Top10 — 점수 스프레드가 0이 아님(100% 모두 0% 표시 예방)", () => {
    const res = recommend({ mbti:"INTP", region:"all", companions:"solo", travelMonth:10 } as UserInput, { limit: 10 });
    expect(res.length).toBeGreaterThanOrEqual(2);
    const scores = res.map(r => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(max - min).toBeGreaterThan(0);
  });
});