import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/recommend/route";

/** Helper to call our API route the same way the browser would */
async function call(body: any, ua?: string) {
  const req = new Request("http://local/api/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ua ? { "User-Agent": ua } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return POST(req as any);
}

const UA_IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const UA_ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

describe("API /api/recommend — 입력 검증 + 브라우저 호환(통합)", () => {
  it.each<[any, number]>([
    [{}, 200], // 모두 생략 → 기본값 처리
    [{ mbti: "INTP" }, 200],
    [{ companions: "couple" }, 200],
    [{ companions: "partner" }, 400], // 허용되지 않는 값
    [{ travelMonth: 13 }, 400],
    [{ travelMonth: 0 }, 400],
    [{ budgetLevel: 6 }, 400],
    [{ budgetLevel: 0 }, 400],
    [{ region: "overseas" }, 200],
    [{ region: "unknown" }, 400],
    [{ birthDate: "2020/01/01" }, 400], // 포맷 불일치
    [{ birthDate: "2020-01-01" }, 200], // ISO8601 허용
  ])("입력 케이스 %o → %s", async (body, status) => {
    const res = await call(body);
    expect(res.status).toBe(status);
  });

  it("유효 입력에서는 results/ctx를 반환한다", async () => {
    const res = await call({ mbti: "INTP", companions: "couple", region: "all" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.ctx?.traits).toBeTruthy();
  });

  it("모바일(iOS Safari) — 정상 스모크 (문자형 숫자 허용)", async () => {
    const res = await call({
      mbti: "ENFP",
      companions: "friends",
      region: "all",
      travelMonth: "10", // string 허용
      budgetLevel: "2",  // string 허용
      birthDate: "1993-05-10",
      birthTime: "09:30",
    }, UA_IOS_SAFARI);
    expect(res.status).toBe(200);
  });

  it("모바일(Android Chrome) — 정상 스모크 (문자형 숫자 허용)", async () => {
    const res = await call({
      mbti: "ISTJ",
      companions: "family",
      region: "overseas",
      travelMonth: "9",
      budgetLevel: "3",
      birthDate: "1990-12-01",
    }, UA_ANDROID_CHROME);
    expect(res.status).toBe(200);
  });

  it("응답 항목은 tier/share/percentile 메타를 포함한다", async () => {
    const res = await call({ mbti: "INTP", companions: "solo", region: "all", travelMonth: 10, budgetLevel: 2 });
    expect(res.status).toBe(200);
    const json = await res.json();
    const item = json.results?.[0];
    expect(typeof item?.tier).toBe("string");
    expect(typeof item?.share).toBe("number");
    expect(typeof item?.percentile).toBe("number");
  });
});