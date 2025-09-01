import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { Destination, UserInput, MBTI, Companion, BudgetLevel, Trait } from "@/lib/types";

const MBTIS: MBTI[] = [
  "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISTP","ESTJ","ESTP","ISFJ","ISFP","ESFJ","ESFP"
];
const COMPANIONS: Companion[] = ["solo","couple","friends","family"];
const BUDGETS: BudgetLevel[] = [1,2,3,4,5];

const baseInput: UserInput = {
  mbti: "INTP", region: "all", companions: "solo", budgetLevel: 2, travelMonth: 10,
};

// 테스트 전용 목적지 팩토리
function makeDest(
  id: string,
  budget: 1|2|3|4|5,
  tp: Partial<Record<Trait, number>> = {},
  extra: Partial<Destination> = {},
): Destination {
  return {
    id, name: id.toUpperCase(), country: extra.country ?? "X",
    region: (extra.region as any) ?? "overseas",
    traitProfile: { social:.5, novelty:.5, structure:.5, flexibility:.5, sensory:.5, culture:.5, ...(tp as any) },
    elementProfile: { wood:.2, fire:.2, earth:.2, metal:.2, water:.2 },
    bestMonths: extra.bestMonths ?? [10],
    budgetLevel: budget,
    notes: [],
    ...(extra as any),
  };
}

describe("scoring — 코어/시즌/다양성/지배도/프리젠테이션", () => {
  describe("예산 필터(strict + fallback) & 시즌 완충", () => {
    it("예산 strict는 '우선순위'를 보장하고, 후보 없으면 완화(fallback)로 결과가 나온다", () => {
      const ds: Destination[] = [ makeDest("L2-OK", 2), makeDest("L3-NG", 3) ];
      const res1 = recommend(
        { ...baseInput, region:"domestic", budgetLevel:2, travelMonth:10 },
        { dataset: ds, limit: 10 }
      );

      // 하드 제외가 아닌 soft-penalty → L2-OK 점수가 L3-NG보다 높아야 함
      const s2 = res1.find(r => r.destination.id === "L2-OK")!.score;
      const s3 = res1.find(r => r.destination.id === "L3-NG")!.score;
      expect(s2).toBeGreaterThan(s3);

      // 같은 레벨 후보가 0건이면 완화(fallback)로라도 결과가 나온다
      const res2 = recommend(
        { ...baseInput, region:"domestic", budgetLevel:1, travelMonth:10 },
        { dataset: ds, limit: 10 }
      );
      expect(res2.length).toBeGreaterThan(0);
    });

    it("시즌 인접월(±1) 완충으로 너무 과하게 밀리지 않는다", () => {
      const ds = [ makeDest("BEST", 2, {}, { bestMonths:[4] }), makeDest("NEAR", 2, {}, { bestMonths:[5] }) ];
      const res = recommend({ ...baseInput, region:"domestic", budgetLevel:2, travelMonth:4 }, { dataset: ds, limit: 10 });
      const sBest = res.find(r => r.destination.id === "BEST")!.score;
      const sNear = res.find(r => r.destination.id === "NEAR")!.score;
      expect(sBest).toBeGreaterThan(sNear);
      expect(sNear).toBeGreaterThan(0);
    });
  });

  describe("다양성(Variety) & 프레젠테이션 메타 범위", () => {
    it("MBTI×동행×예산 변화에 따라 Top1이 고정되지 않는다(다양성 확보)", () => {
      const ids1 = new Set<string>();
      for (const mbti of MBTIS) {
        const id = recommend({ ...baseInput, mbti }, { limit:1 })[0]?.destination.id;
        if (id) ids1.add(id);
      }
      expect(ids1.size).toBeGreaterThanOrEqual(2);

      const ids2 = new Set<string>();
      for (const c of COMPANIONS) {
        const id = recommend({ ...baseInput, companions:c }, { limit:1 })[0]?.destination.id;
        if (id) ids2.add(id);
      }
      expect(ids2.size).toBeGreaterThanOrEqual(2);

      const ids3 = new Set<string>();
      for (const b of BUDGETS) {
        const id = recommend({ ...baseInput, budgetLevel:b }, { limit:1 })[0]?.destination.id;
        if (id) ids3.add(id);
      }
      expect(ids3.size).toBeGreaterThanOrEqual(2);
    });

    it("Top10 점수 스프레드가 0이 아니다 + 메타 필드 범위 체크", () => {
      const res = recommend({ ...baseInput }, { limit: 10 });
      expect(res.length).toBeGreaterThanOrEqual(2);
      const scores = res.map(r => r.score);
      expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(0);

      for (const r of res) {
        expect(["S","A","B","C","D"]).toContain(r.tier);
        expect(r.share).toBeGreaterThan(0);
        expect(r.share).toBeLessThanOrEqual(1);
        expect(r.percentile).toBeGreaterThanOrEqual(0);
        expect(r.percentile).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("지배도(Dominance) 캡 & 과도한 고가 필터", () => {
    it("해외(region=overseas) 샘플링에서 특정 국가가 60%를 넘지 않는다", () => {
      const counts = new Map<string, number>();
      let total = 0;
      for (const mbti of MBTIS) for (const c of COMPANIONS) {
        for (const m of [1,5,9,12] as const) {
          const r = recommend({ ...baseInput, mbti, companions:c, region:"overseas", budgetLevel:1, travelMonth:m }, { limit: 1 })[0];
          if (r) counts.set(r.destination.country, (counts.get(r.destination.country) ?? 0) + 1);
          total++;
        }
      }
      const top = Math.max(0, ...counts.values());
      expect(top / Math.max(1,total)).toBeLessThanOrEqual(0.60);
    });

    it("요청 대비 과도한 고가 목적지는 프레젠테이션 규칙으로 걸러진다", () => {
      const ds = [
        makeDest("GOOD", 2, { structure:.9 }, { country:"A" }),
        makeDest("OVERPRICE", 5, { structure:.1 }, { country:"B" }),
      ];
      const res = recommend({ ...baseInput, budgetLevel: 1 }, { dataset: ds, limit: 5 });
      const ids = res.map(r => r.destination.id);
      expect(ids).toContain("GOOD");
      expect(ids).not.toContain("OVERPRICE");
    });
  });
});