import { describe, it, expect, beforeAll } from "vitest";
import { getElements, getElementsWithDetail } from "@/lib/sajuElements";

/**
 * 테스트 전역 설정
 * - Asia/Seoul 기준으로 날짜/시간이 해석되도록 TZ를 고정한다.
 * - sajuElements가 로컬 타임존(Date) 기반 계산을 하므로 재현성을 위해 필수.
 */
beforeAll(() => { process.env.TZ = "Asia/Seoul"; });

/**
 * sum
 * - 목적: 오행 분포 객체의 합계를 계산(정규화 검증에 사용)
 * - 기대: getElements / getElementsWithDetail 결과의 합은 항상 1(오차 허용)
 */
function sum(obj: Record<string, number>) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

describe("sajuElements — 오행 합=1 및 시간 유/무 분기", () => {
  /**
   * 케이스 1: birthDate 미입력
   * - 기대: 완전 중립(균등) 분포로 합=1, 모든 값이 0보다 큼
   * - 기대: 시간 정보 없음 → hourBranch는 '-' 문자열
   */
  it("birthDate 미입력 시 NEUTRAL(균등) & hourBranch='-'", () => {
    const { elements, pillars } = getElementsWithDetail({} as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(Object.values(elements).every((v) => v > 0)).toBe(true);
    expect(pillars.hourBranch).toBe("-");
  });

  /**
   * 케이스 2: birthDate만 입력
   * - 기대: 합=1 유지
   * - 기대: birthTime이 없으므로 hourBranch는 '-'
   */
  it("birthDate만 입력하면 hourBranch='-'이며 합=1", () => {
    const { elements, pillars } = getElementsWithDetail({ birthDate: "1990-01-01" } as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(pillars.hourBranch).toBe("-");
  });

  /**
   * 케이스 3: birthDate + birthTime 입력
   * - 기대: 합=1 유지
   * - 기대: 시지 계산이 들어가므로 hourBranch는 '-'가 아님
   */
  it("birthDate+birthTime 입력 시 hourBranch가 '-'가 아니다", () => {
    const { elements, pillars } = getElementsWithDetail({ birthDate: "1990-01-01", birthTime: "00:30" } as any);
    expect(sum(elements)).toBeCloseTo(1, 6);
    expect(pillars.hourBranch).not.toBe("-");
  });

  /**
   * 케이스 4: getElements 단축 함수의 정규화 보장
   * - 기대: 입력 유무와 관계없이 항상 합=1인 분포를 반환
   */
  it("getElements는 항상 합이 1인 분포를 반환한다", () => {
    expect(sum(getElements({} as any))).toBeCloseTo(1, 6);
    expect(sum(getElements({ birthDate: "1990-01-01" } as any))).toBeCloseTo(1, 6);
    expect(sum(getElements({ birthDate: "1990-01-01", birthTime: "08:00" } as any))).toBeCloseTo(1, 6);
  });
});