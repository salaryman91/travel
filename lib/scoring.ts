import { mbtiToTraits } from "./mbtiToTraits";
import { getElements, getElementsWithDetail } from "./sajuElements";
import { destinations } from "@/data/destinations";
import type {
  UserInput, Element, Trait, Destination, PersonalizationContext
} from "./types";

// 가중치: 예산 영향 강화
const W = { alpha: 0.50, beta: 0.40, gamma: 0.35 };
// 예산 필터 모드
//  - 'strict' : 선택한 레벨과 "동일"한 목적지만 허용 (요청 사항)
//  - 'band'   : 선택 ±1 레벨 허용
//  - 'cap'    : 사용자 예산보다 2단계 이상 비싸면 제외(기존 동작)
type BudgetFilterMode = "strict" | "band" | "cap";
const BUDGET_FILTER_MODE: BudgetFilterMode = "strict";

function isBudgetAllowed(d: Destination, i: UserInput) {
  if (!i.budgetLevel) return true; // 미선택 시 모든 예산 허용
  const delta = d.budgetLevel - i.budgetLevel;
  switch (BUDGET_FILTER_MODE) {
    case "strict": return delta === 0;
    case "band":   return Math.abs(delta) <= 1;
    case "cap":
    default:       return delta < 2; // 2단계 이상 비싸면 제외, 싼 곳 허용(기존)
  }
}

const dot = <K extends string>(
  a: Partial<Record<K, number>>,
  b: Partial<Record<K, number>>
) =>
  Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).reduce(
    (s, k) => s + (a[k as K] ?? 0) * (b[k as K] ?? 0),
    0
  );

const penalty = (d: Destination, i: UserInput) => {
  let p = 0;
  // 시즌 미스매치
  if (i.travelMonth && d.bestMonths && !d.bestMonths.includes(i.travelMonth)) p += 0.35;
  // 예산 초과: 단계 차이에 비례
  if (i.budgetLevel) {
    const over = Math.max(0, d.budgetLevel - i.budgetLevel);
    if (over > 0) p += 0.55 * over;
    const under = Math.max(0, i.budgetLevel - d.budgetLevel);
    if (under > 0) p -= 0.06 * under;
  }
  // 1인 여행 안정성 보정(약하게)
  if (i.companions === "solo") {
    const safe = (d.traitProfile.structure ?? 0) + (d.traitProfile.culture ?? 0);
    p -= 0.08 * safe;
  }
  return Math.max(0, Math.min(1, p));
};

type Explain = {
  mbtiTop: [Trait, number][];
  sajuTop: [Element, number][];
  notes: string[];
};

function budgetAdvice(d: Destination, i: UserInput): string[] {
  if (!i.budgetLevel) return [];
  const delta = d.budgetLevel - i.budgetLevel;
  const tips: string[] = [];
  if (delta >= 2) tips.push("※ 예산 대비 고가: 오프시즌/근교 대체지 고려 권장.");
  if (delta > 0) {
    tips.push(
      "항공: LCC·경유, 날짜 유연성",
      "숙소: 3성/게하, 시내 한 정거장 밖",
      "활동: 무료 산책·박물관 위주"
    );
  } else if (delta < 0) {
    tips.push("여유 예산: 4성+ 업그레이드/시그니처 투어 1회/미식 1식");
  }
  return tips;
}

function top2<T extends string>(v: Record<T, number>): [T, number][] {
  return (Object.entries(v) as [T, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
}

function explain(
  d: Destination,
  traits: Record<Trait, number>,
  elems: Record<Element, number>,
  input: UserInput
): Explain {
  const mb = top2(traits);
  const sj = top2(elems);
  const notes = [...(d.notes ?? [])];
  if (!input.birthDate) notes.push("사주 미입력: MBTI 중심 추천");
  if (input.birthDate && !(input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime)))
    notes.push("출생 시각 미상: 시간(시지) 영향 제외");
  notes.push(...budgetAdvice(d, input));
  return { mbtiTop: mb, sajuTop: sj, notes };
}

export function recommend(input: UserInput, opt?: { limit?: number }) {
  const traits = mbtiToTraits(input.mbti);
  const elems = getElements(input);

  const hasDate = !!input.birthDate;
  const hasTime = !!input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime ?? "");
  const betaLocal = hasDate ? (hasTime ? W.beta : W.beta * 0.7) : 0; // 사주 미입력 → 오행 영향 0

  let pool =
    input.region && input.region !== "all"
      ? destinations.filter((d) => d.region === input.region)
      : destinations;

  // 예산 필터 적용 (strict 모드면 선택 레벨과 동일한 목적지만 남김)
  pool = pool.filter((d) => isBudgetAllowed(d, input));

  return pool
    .map((d) => {
      const sc =
        W.alpha * dot<Trait>(traits, d.traitProfile) +
        betaLocal * dot<Element>(elems, d.elementProfile) -
        W.gamma * penalty(d, input);
      return {
        destination: d,
        score: Number(sc.toFixed(4)),
        explain: explain(d, traits, elems, input),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opt?.limit ?? 5);
}

export function getPersonalization(input: UserInput): PersonalizationContext {
  const traits = mbtiToTraits(input.mbti);
  const { elements, pillars } = getElementsWithDetail(input);
  return { traits, elements, pillars };
}