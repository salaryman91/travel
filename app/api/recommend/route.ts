import { NextResponse } from "next/server";
import { recommend, getPersonalization } from "@/lib/scoring";
import type { UserInput } from "@/lib/types";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<UserInput>;
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
  return NextResponse.json({ results, ctx }, { headers: { "Cache-Control": "s-maxage=60" } });
}