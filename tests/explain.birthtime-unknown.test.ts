import { describe, it, expect } from "vitest";
import { recommend } from "@/lib/scoring";
import type { UserInput } from "@/lib/types";

describe("설명 노트 — 출생 시간 모름/포맷 처리", () => {
  const base: UserInput = {
    mbti: "INTP",
    region: "all",
    companions: "solo",
    budgetLevel: 2,
    travelMonth: 10,
    birthDate: "1991-01-18",
  };

  it("birthTime이 undefined(모름)일 때 '출생 시각 미상' 문구가 없어야 한다", () => {
    const res = recommend({ ...base }, { limit: 5 });
    const notes = res[0]?.explain?.notes?.join(" ") ?? "";
    expect(notes.includes("출생 시각 미상")).toBe(false);
  });

  it("birthTime이 잘못된 문자열일 때만 문구가 포함된다(라이브러리 직접 호출 시)", () => {
    const res = recommend({ ...base, birthTime: "9시" } as any, { limit: 5 });
    const notes = res[0]?.explain?.notes?.join(" ") ?? "";
    expect(notes.includes("출생 시각 미상")).toBe(true);
  });
});