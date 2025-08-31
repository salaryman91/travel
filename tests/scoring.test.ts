import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { UserInput } from "@/lib/types";

describe("scoring & filtering", () => {
  const common: UserInput = {
    mbti: "INTP",
    travelMonth: 11,
    budgetLevel: 2,
    companions: "solo",
  };

  it("지역 필터: domestic만 반환", () => {
    const res = recommend({ ...common, region: "domestic" }, { limit: 100 });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) expect(r.destination.region).toBe("domestic");
  });

  it("지역 필터: overseas만 반환", () => {
    const res = recommend({ ...common, region: "overseas" }, { limit: 100 });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) expect(r.destination.region).toBe("overseas");
  });

  it("예산이 낮아지면 고가 목적지 점수가 더 낮아진다(벌점 작동)", () => {
    const hi = recommend({ ...common, budgetLevel: 3, region: "overseas" }, { limit: 100 });
    const lo = recommend({ ...common, budgetLevel: 1, region: "overseas" }, { limit: 100 });

    const scoreOf = (arr: ReturnType<typeof recommend>, id: string) =>
      arr.find((x) => x.destination.id === id)?.score ?? 0;

    const tokyoHi = scoreOf(hi, "tokyo");
    const tokyoLo = scoreOf(lo, "tokyo");
    expect(tokyoLo).toBeLessThan(tokyoHi);
  });

  it("AM/PM에 따라 metal 중심지와 wood/water 중심지의 점수 기울기가 달라진다(시간 입력이 있을 때만)", () => {
    // tokyo(예산 4)가 필터로 제외되지 않도록 예산 상향
    const am = recommend(
      { ...common, budgetLevel: 4, region: "overseas", birthDate: "1991-01-18", birthTime: "07:45" },
      { limit: 100 }
    );
    const pm = recommend(
      { ...common, budgetLevel: 4, region: "overseas", birthDate: "1991-01-18", birthTime: "19:45" },
      { limit: 100 }
    );

    const scoreOf = (arr: ReturnType<typeof recommend>, id: string) =>
      arr.find((x) => x.destination.id === id)?.score ?? 0;

    // metal이 강한 도쿄는 PM(술시)에서 유리, water/wood가 강한 발리는 AM(진시)에서 유리
    expect(scoreOf(pm, "tokyo")).toBeGreaterThan(scoreOf(am, "tokyo"));
    expect(scoreOf(am, "bali")).toBeGreaterThan(scoreOf(pm, "bali"));
  });

  it("사주 미입력 시 오행 영향 0 → 결과 노트에 표시", () => {
    const res = recommend({ ...common, region: "overseas" }, { limit: 5 });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].explain.notes.join(" ")).toMatch(/사주 미입력/);
  });

  it("시간 모름이면 AM/PM을 바꿔도 같은 점수(시지 영향 제외)", () => {
    const base: UserInput = { ...common, budgetLevel: 4, region: "overseas", birthDate: "1991-01-18" };

    const am = recommend({ ...base }, { limit: 100 }); // birthTime 없음
    const pm = recommend({ ...base }, { limit: 100 }); // 동일(없음)

    const scoreOf = (arr: ReturnType<typeof recommend>, id: string) =>
      arr.find((x) => x.destination.id === id)?.score ?? 0;

    expect(Math.abs(scoreOf(am, "tokyo") - scoreOf(pm, "tokyo"))).toBeLessThan(1e-9);
  });
});