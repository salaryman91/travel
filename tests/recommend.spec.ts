import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/recommend/route";

// JSON Request 생성 헬퍼
function jreq(body: any, headers?: Record<string,string>) {
  return new Request("http://local/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

describe("API /api/recommend — 입력 스키마 & 계약", () => {
  it("정상 입력은 200과 results/ctx를 반환", async () => {
    const res = await POST(jreq({
      mbti: "INTP", travelMonth: 10, budgetLevel: 2, companions: "solo", region: "all",
      birthDate: "1991-01-18", birthTime: "09:30",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.ctx?.elements).toBeTruthy();
  });

  it("문자 숫자도 coerce(number) 허용", async () => {
    const res = await POST(jreq({
      travelMonth: "7",        // string 허용
      budgetLevel: "2",        // string 허용
      companions: "family",
      region: "domestic",
    }));
    expect(res.status).toBe(200);
  });

  it("birthTime=null 은 400 (null 불가, '' 또는 HH:mm만 허용)", async () => {
    const res = await POST(jreq({
      birthDate: "1990-01-02",
      birthTime: null, // ❌
    }));
    expect(res.status).toBe(400);
  });

  it("birthTime='' 은 undefined로 처리(200)", async () => {
    const res = await POST(jreq({
      birthDate: "1990-01-02",
      birthTime: "", // transform → undefined
    }));
    expect(res.status).toBe(200);
  });

  it("birthTime 포맷 불일치(9:00)면 400", async () => {
    const res = await POST(jreq({ birthDate: "1990-01-02", birthTime: "9:00" }));
    expect(res.status).toBe(400);
  });

  it("birthDate 포맷 불일치면 400", async () => {
    const res = await POST(jreq({ birthDate: "1990/01/02" }));
    expect(res.status).toBe(400);
  });

  it("잘못된 JSON 본문은 400", async () => {
    const req = new Request("http://local/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{not-json}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("필드 미지정 시 합리적 기본값 사용(mbti=INTP, companions=solo, region=all)", async () => {
    const res = await POST(jreq({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
  });
});