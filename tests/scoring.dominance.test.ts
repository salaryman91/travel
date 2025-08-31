import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import { destinations } from "@/data/destinations";
import type { UserInput, MBTI, Companion, BudgetLevel } from "@/lib/types";

/** 공통 유틸 */
const MBTIS: MBTI[] = [
  "INTJ","INTP","ENTJ","ENTP",
  "INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISFJ","ESTJ","ESFJ",
  "ISTP","ISFP","ESTP","ESFP",
];
const COMPANIONS: Companion[] = ["solo","couple","friends","family"];
const BUDGETS: BudgetLevel[] = [1,2,3,4,5] as BudgetLevel[];

function top1Id(input: UserInput, ds = destinations) {
  return recommend(input, { dataset: ds, limit: 1 })[0]?.destination.id;
}

function dominanceShare(cases: Partial<UserInput>[], label: string) {
  const counts = new Map<string, number>();
  let total = 0;
  for (const c of cases) {
    const id = top1Id({
      mbti: (c as any).mbti ?? "INTP",
      companions: (c as any).companions ?? "solo",
      region: (c as any).region ?? "all",
      travelMonth: (c as any).travelMonth ?? 10,
      budgetLevel: (c as any).budgetLevel ?? 2,
    } as UserInput);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    total++;
  }
  const sorted = [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const [topId, top] = sorted[0] ?? ["(none)", 0];
  // eslint-disable-next-line no-console
  console.log(`[dominance:${label}] total=${total} top=${topId}:${top} share=${(top/Math.max(1,total)).toFixed(3)}`);
  return top / Math.max(1,total);
}

describe("과점 가드 — 단일 목적지/국가가 상위를 과점하지 않도록", () => {
  it("전 목적지 기준: 단일 목적지 Top1 점유율 ≤ 60%", () => {
    const cases: Partial<UserInput>[] = [];
    for (const mbti of MBTIS) {
      for (const companions of COMPANIONS) {
        for (const budgetLevel of BUDGETS) {
          for (const travelMonth of [2,6,10]) {
            cases.push({ mbti, companions, budgetLevel, region:"all", travelMonth });
          }
        }
      }
    }
    expect(dominanceShare(cases, "all-dests")).toBeLessThanOrEqual(0.60);
  });

  it("해외만/국가 기준: 최저예산에서도 단일 국가 과점 ≤ 60% (일반은 ≤45%)", () => {
    // 일반 케이스(여러 예산)
    {
      const counts = new Map<string, number>();
      let total = 0;
      for (const mbti of MBTIS) for (const companions of COMPANIONS) {
        for (const budgetLevel of [2,3,4] as BudgetLevel[]) for (const travelMonth of [3,8,11]) {
          const r = recommend({ mbti, companions, region:"overseas", budgetLevel, travelMonth } as UserInput, { limit: 1 })[0];
          if (r) counts.set(r.destination.country, (counts.get(r.destination.country) ?? 0) + 1);
          total++;
        }
      }
      const top = Math.max(0, ...counts.values());
      expect(top / Math.max(1,total)).toBeLessThanOrEqual(0.45);
    }
    // 최저예산(=SEA 편향 가능성)만 별도 강화 체크
    {
      const counts = new Map<string, number>();
      let total = 0;
      for (const mbti of MBTIS) for (const companions of COMPANIONS) {
        for (const travelMonth of [1,5,9,12] as const) {
          const r = recommend({ mbti, companions, region:"overseas", budgetLevel:1, travelMonth } as UserInput, { limit: 1 })[0];
          if (r) counts.set(r.destination.country, (counts.get(r.destination.country) ?? 0) + 1);
          total++;
        }
      }
      const top = Math.max(0, ...counts.values());
      expect(top / Math.max(1,total)).toBeLessThanOrEqual(0.60);
    }
  });
});