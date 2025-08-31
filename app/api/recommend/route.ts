import { NextResponse } from "next/server";
import { recommend, getPersonalization } from "@/lib/scoring";
import type { UserInput } from "@/lib/types";
import { z } from "zod";

export const runtime = "edge";

// 입력 스키마(엣지 안전, 실패 시 400)
const InputSchema = z.object({
  mbti: z
    .enum([
      "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
      "ISTJ","ISTP","ESTJ","ESTP","ISFJ","ISFP","ESFJ","ESFP",
    ])
    .optional(),
  travelMonth: z.number().int().min(1).max(12).optional(),
  budgetLevel: z.number().int().min(1).max(5).optional(),
  companions: z.enum(["solo","couple","friends","family"]).optional(),
  region: z.enum(["all","domestic","overseas"]).optional(),
  // YYYY-MM-DD
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // HH:MM (24h)
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function POST(req: Request) {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const body = parsed.data as Partial<UserInput>;
  const input: UserInput = {
    mbti: body.mbti ?? "INTP",
    travelMonth: body.travelMonth,
    budgetLevel: body.budgetLevel,
    companions: body.companions ?? "solo",
    region: body.region ?? "all",
    birthDate: body.birthDate,
    birthTime: body.birthTime,
  };

  const results = recommend(input, { limit: 20 });
  const ctx = getPersonalization(input);

  return NextResponse.json(
    { results, ctx },
    { headers: { "Cache-Control": "s-maxage=60" } }
  );
}