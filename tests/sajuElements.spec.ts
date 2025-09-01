import { describe, it, expect, beforeAll } from "vitest";
import { getElements, getElementsWithDetail } from "@/lib/sajuElements";

beforeAll(() => { process.env.TZ = "Asia/Seoul"; });

function sum(obj: Record<string, number>) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

describe("sajuElements — 오행 합=1 및 시간 유/무 분기", () => {
  it("birthDate 미입력 시 NEUTRAL(균등) & hourBranch='-'", () => {
    const { elements, pillars } = getElementsWithDetail({} as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(Object.values(elements).every((v) => v > 0)).toBe(true);
    expect(pillars.hourBranch).toBe("-");
  });

  it("birthDate만 입력하면 hourBranch='-'이며 합=1", () => {
    const { elements, pillars } = getElementsWithDetail({ birthDate: "1990-01-01" } as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(pillars.hourBranch).toBe("-");
  });

  it("birthDate+birthTime 입력 시 hourBranch가 '-'가 아니다", () => {
    const { elements, pillars } = getElementsWithDetail({ birthDate: "1990-01-01", birthTime: "00:30" } as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(pillars.hourBranch).not.toBe("-");
  });

  it("getElements는 항상 합이 1인 분포를 반환한다", () => {
    expect(sum(getElements({} as any))).toBeCloseTo(1, 6);
    expect(sum(getElements({ birthDate: "1990-01-01" } as any))).toBeCloseTo(1, 6);
    expect(sum(getElements({ birthDate: "1990-01-01", birthTime: "08:00" } as any))).toBeCloseTo(1, 6);
  });
});