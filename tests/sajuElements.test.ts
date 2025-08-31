import { describe, it, expect } from "vitest";
import { getElementsWithDetail } from "@/lib/sajuElements";

describe("sajuElements", () => {
  it("사주 미입력 시 오행은 완전 중립(≈0.2) & 간지는 '-'", () => {
    const { elements, pillars } = getElementsWithDetail({ mbti: "INTP" } as any);
    const vals = Object.values(elements);
    vals.forEach((v) => expect(Math.abs(v - 0.2)).toBeLessThan(1e-6));
    expect(pillars.yearStem).toBe("-");
    expect(pillars.monthStem).toBe("-");
    expect(pillars.hourBranch).toBe("-");
  });

  it("시간 모름이면 hourBranch는 '-'이고, 같은 날짜라도 시간 입력 시와 요소 비율이 달라진다", () => {
    const date = "1991-01-18";

    const noTime = getElementsWithDetail({ mbti: "INTP", birthDate: date } as any);
    const withTime = getElementsWithDetail({ mbti: "INTP", birthDate: date, birthTime: "07:45" } as any);

    expect(noTime.pillars.hourBranch).toBe("-");
    expect(withTime.pillars.hourBranch).not.toBe("-");

    const keys = ["wood","fire","earth","metal","water"] as const;
    const sumDiff = keys
      .map((k) => Math.abs(noTime.elements[k] - withTime.elements[k]))
      .reduce((a, b) => a + b, 0);

    expect(sumDiff).toBeGreaterThan(0); // 시지 블렌드가 반영되어야 함
  });
});