import { NextResponse } from "next/server";
import { recommend, getPersonalization } from "@/lib/scoring";
import type { UserInput } from "@/lib/types";
import { z } from "zod";

/**
 * Next.js App Router API Route (Edge Runtime)
 * - 목적: MBTI × 사주 입력값을 받아 여행지 추천 결과를 반환
 * - 보안/안정성: 모든 입력은 Zod로 검증하고, 실패 시 400 응답
 * - 주의: Edge 런타임에서는 Node 전용 API(fs, net 등)를 사용하지 말 것
 */
export const runtime = "edge";

/**
 * 입력 스키마 정의
 * - 모든 필드는 optional → 검증 통과 후 필요한 기본값을 코드에서 주입
 * - number 계열은 z.coerce.number()로 "문자열 숫자"도 허용
 * - 날짜/시간은 빈 문자열("")을 undefined로 정규화하여 서버 내부 도메인 로직과 충돌 방지
 */
const InputSchema = z.object({
  // MBTI (없으면 추후 기본값 적용)
  mbti: z
    .enum([
      "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
      "ISTJ","ISTP","ESTJ","ESTP","ISFJ","ISFP","ESFJ","ESFP",
    ])
    .optional(),

  // 여행 월 (1~12, "12" 같은 문자열도 허용)
  travelMonth: z.coerce.number().int().min(1).max(12).optional(),

  // 예산 단계 (1~5)
  budgetLevel: z.coerce.number().int().min(1).max(5).optional(),

  // 동행자
  companions: z.enum(["solo","couple","friends","family"]).optional(),

  // 지역 필터
  region: z.enum(["all","domestic","overseas"]).optional(),

  /**
   * 생년월일 (YYYY-MM-DD)
   * - 입력 트림 → 정규식 검증(YYYY-MM-DD) → ""(빈값)은 허용
   * - 최종적으로 ""는 undefined로 변환하여 도메인 로직과 충돌 방지
   * - 예: "1999-01-01" OK, "99-01-01" → 400 (2자리 연도 금지)
   */
  birthDate: z
    .string()
    .transform(s => (typeof s === "string" ? s.trim() : s))
    .refine(
      (s) => s === undefined || s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s as string),
      { message: "birthDate must be YYYY-MM-DD" }
    )
    .optional()
    .transform(s => (!s ? undefined : s)),

  /**
   * 출생시간 (24h HH:MM)
   * - ""(모름) 또는 "HH:MM" 형식을 허용
   * - 최종적으로 ""는 undefined로 정규화
   * - 예: "09:30" OK, "9:30" → 400 (앞자리는 0 포함 2자리)
   */
  birthTime: z
    .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)])
    .optional()
    .transform((s) => (!s ? undefined : s)),
});

/**
 * POST /api/...(예: /api/recommend)
 * 1) JSON 파싱(실패 시 400)
 * 2) 스키마 검증(실패 시 400 + 상세 이슈)
 * 3) 기본값 주입 및 입력 정규화
 * 4) 추천/퍼스널라이제이션 도메인 호출
 * 5) 결과 JSON 반환 + 캐시 헤더(s-maxage=60)
 */
export async function POST(req: Request) {
  // 1) JSON 파싱: Body가 비어있거나 올바르지 않으면 400
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 2) 유효성 검사: 실패 시 어떤 필드가 왜 실패했는지 issues로 전달
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // 3) 기본값 주입: 스키마 통과 후 도메인 모델(UserInput)로 정규화
  const body = parsed.data as Partial<UserInput>;
  const input: UserInput = {
    mbti: body.mbti ?? "INTP",          // 기본 MBTI
    travelMonth: body.travelMonth,      // 선택 입력
    budgetLevel: body.budgetLevel,      // 선택 입력
    companions: body.companions ?? "solo",
    region: body.region ?? "all",
    birthDate: body.birthDate,          // "" → undefined로 이미 정규화됨
    birthTime: body.birthTime,          // "" → undefined로 이미 정규화됨
  };

  // 4) 도메인 로직: 추천 결과 상위 20개, 개인화 컨텍스트 생성
  const results = recommend(input, { limit: 20 });
  const ctx = getPersonalization(input);

  // 5) 응답: Edge 캐시 60초(SWR 형태로 CDN 캐시 활용)
  return NextResponse.json(
    { results, ctx },
    { headers: { "Cache-Control": "s-maxage=60" } }
  );
}