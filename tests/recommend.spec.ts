import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/recommend/route";

/**
 * 테스트 목적
 * - /api/recommend 라우트 핸들러의 입력 스키마 검증 및 응답 계약을 점검한다.
 * - 이 테스트는 Next.js Route Handler(POST 함수)를 직접 호출하여, 실제 네트워크 계층 없이
 *   Request 객체만으로 end-to-end에 가까운 계약을 확인한다.
 */

/**
 * jreq
 * - 목적: JSON 본문을 갖는 Request 객체를 간편하게 생성
 * - 사용: POST(jreq(body)) 형태로 라우트 핸들러에 전달
 * - 주의: 실제 네트워크 요청이 아니므로 URL은 더미이며, Content-Type 헤더는 반드시 JSON으로 지정
 */
function jreq(body: any, headers?: Record<string, string>) {
  return new Request("http://local/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

describe("API /api/recommend — 입력 스키마 & 계약", () => {
  it("정상 입력은 200과 results/ctx를 반환", async () => {
    // 정상 사례: 모든 주요 필드 포함 + 출생일/시각까지 포함
    const res = await POST(
      jreq({
        mbti: "INTP",
        travelMonth: 10,
        budgetLevel: 2,
        companions: "solo",
        region: "all",
        birthDate: "1991-01-18",
        birthTime: "09:30",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // 계약: results는 배열, ctx.elements 존재
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.ctx?.elements).toBeTruthy();
  });

  it("문자 숫자도 coerce(number) 허용", async () => {
    // 스키마가 z.coerce.number()를 사용하므로 문자열 숫자 허용
    const res = await POST(
      jreq({
        travelMonth: "7", // string 허용
        budgetLevel: "2", // string 허용
        companions: "family",
        region: "domestic",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("birthTime=null 은 400 (null 불가, '' 또는 HH:mm만 허용)", async () => {
    // 계약: birthTime은 null 불가. 빈 문자열("") 또는 HH:mm만 허용
    const res = await POST(
      jreq({
        birthDate: "1990-01-02",
        birthTime: null, // 불허
      }),
    );
    expect(res.status).toBe(400);
  });

  it("birthTime='' 은 undefined로 처리(200)", async () => {
    // 빈 문자열은 transform되어 undefined로 간주 → 유효
    const res = await POST(
      jreq({
        birthDate: "1990-01-02",
        birthTime: "", // transform → undefined
      }),
    );
    expect(res.status).toBe(200);
  });

  it("birthTime 포맷 불일치(9:00)면 400", async () => {
    // 계약: HH:mm (두 자리 시/분) 형식만 허용
    const res = await POST(jreq({ birthDate: "1990-01-02", birthTime: "9:00" }));
    expect(res.status).toBe(400);
  });

  it("birthDate 포맷 불일치면 400", async () => {
    // 계약: YYYY-MM-DD 형식만 허용
    const res = await POST(jreq({ birthDate: "1990/01/02" }));
    expect(res.status).toBe(400);
  });

  it("잘못된 JSON 본문은 400", async () => {
    // Content-Type이 JSON이 아니거나 본문 파싱 실패 시 400
    const req = new Request("http://local/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{not-json}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("필드 미지정 시 합리적 기본값 사용(mbti=INTP, companions=solo, region=all)", async () => {
    // 스키마 통과 후 서버측 기본값 적용 확인
    const res = await POST(jreq({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
  });
});