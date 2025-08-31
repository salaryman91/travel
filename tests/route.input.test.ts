import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/recommend/route";

describe("API /api/recommend 입력 검증 (병합)", () => {
  it.each([
    [{}, 200], // 모두 생략 → 기본값으로 처리
    [{ mbti: "INTP" }, 200],
    [{ companions: "couple" }, 200], // 커플 허용
    [{ companions: "partner" }, 400], // 허용되지 않는 값
    [{ travelMonth: 13 }, 400], // 범위 초과
    [{ travelMonth: 0 }, 400],
    [{ budgetLevel: 6 }, 400],
    [{ budgetLevel: 0 }, 400],
    [{ region: "overseas" }, 200],
    [{ region: "unknown" }, 400],
    [{ birthDate: "2020/01/01" }, 400], // 포맷 불일치
    [{ birthDate: "2020-01-01", birthTime: "09:30" }, 200],
    [{ birthDate: "2020-01-01", birthTime: "9시" }, 400], // 포맷 불일치
  ])("POST %p -> %p", async (body, expectedStatus) => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(expectedStatus);
  });

  it("유효 입력에서는 results/ctx를 반환한다", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ mbti: "INTP", companions: "couple", region: "all" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.ctx?.traits).toBeTruthy();
  });
});