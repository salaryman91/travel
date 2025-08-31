import { mbtiToTraits } from "./mbtiToTraits";
import { getElements, getElementsWithDetail } from "./sajuElements";
import { destinations } from "@/data/destinations";
import type {
  UserInput, Element, Trait, Destination, PersonalizationContext
} from "./types";

// 가중치: 예산 영향 강화
const W = { alpha: 0.50, beta: 0.40, gamma: 0.35 };
// 동반형태 가산을 "데이터 커버리지"에 따라 동적으로 확대
//  - BASE: 최소 영향
//  - VAR : 커버리지(0~1)에 비례해 추가 가중
//  - RANK_NUDGE: 동점/근사점에서 동반형태를 살짝 우대(정렬·체감용)
const COMP_BONUS_BASE = 0.18;
const COMP_BONUS_VAR  = 0.24; // 커버리지 1.0이면 BASE+VAR=0.42까지
const RANK_NUDGE      = 0.03; // 순위 타이브레이커(표시 점수에도 소폭 반영)

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// 거리(비행시간) 페널티에 쓰는 로지스틱
const logistic = (x: number, k = 0.8, x0 = 1) => 1 / (1 + Math.exp(-k * (x - x0)));
// (임시) 거리 페널티 전역 스위치 — 현 시점 OFF
const DISTANCE_PENALTY_ENABLED = false;

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
) => {
  const keys = new Set<string>([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);
  let s = 0;
  for (const k of keys) s += (a[k as K] ?? 0) * (b[k as K] ?? 0);
  return s;
};

// 동반형태 적합도(0~1). 데이터 없으면 0.5(중립).
function companionScore(d: Destination, i: UserInput): number {
  const c = i.companions;
  if (!c) return 0.5;
  let s = 0, n = 0;
  const push = (v?: number, w = 1) => { if (typeof v === "number") { s += v * w; n += w; } };
  const bump = (ok: boolean, v = 0.2) => { if (ok) { s += v; n += 1; } };
  // 공통 지표
  push(d.safetyIndex,  c === "solo" ? 1.2 : 0.8);
  push(d.accessEase,   c === "solo" ? 1.0 : 0.8);
  push(d.groupEase,   (c === "friends" || c === "family") ? 1.2 : 0.6);
  push(d.nightlife,   (c === "friends" || c === "couple") ? 1.1 : 0.5);
  push(d.languageEase, 0.8);
  bump(!!d.kidFriendly && c === "family", 0.2);
  bump(!!d.suitableFor?.includes(c), 0.2);
  return n === 0 ? 0.5 : clamp01(s / n);
}

// 동반형태 관련 "커버리지"(데이터가 얼마나 채워졌는지) 0~1
function companionCoverage(d: Destination): number {
  const fields: Array<keyof Destination> = [
    "safetyIndex","accessEase","languageEase","nightlife","groupEase"
  ];
  let filled = 0;
  for (const k of fields) if (typeof (d as any)[k] === "number") filled++;
  // 불리언/배열도 약간의 가점
  if (typeof (d as any).kidFriendly === "boolean") filled += 0.5;
  if (Array.isArray((d as any).suitableFor))    filled += 0.5;
  const max = fields.length + 1; // 5 + (kidFriendly/suitableFor 합쳐 1)
  return clamp01(filled / max);
}

const penalty = (d: Destination, i: UserInput) => {
  let p = 0;
  // 시즌 미스매치
  if (i.travelMonth && d.bestMonths) {
    const inBest = d.bestMonths.includes(i.travelMonth);
    if (!inBest) {
      // 부드러운 완충: 인접 월이면 0.15, 그 외 0.35
      const near = d.bestMonths.some(m => Math.min(Math.abs(m - i.travelMonth!), 12 - Math.abs(m - i.travelMonth!)) === 1);
      p += near ? 0.15 : 0.35;
    }
  }
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
  // 거리(비행시간) 페널티: 허용치 초과 시 연속적으로 가산
  if (typeof i.maxFlightHours === "number" && typeof d.avgFlightHoursFromICN === "number") {
    const diff = d.avgFlightHoursFromICN - i.maxFlightHours;
    if (diff > 0) p += 0.25 * logistic(diff, 0.8, 1); // 1~3시간 초과 구간에서 부드럽게 증가
  }  
  return Math.max(0, Math.min(1, p));
};

type Explain = {
  mbtiTop: [Trait, number][];
  sajuTop: [Element, number][];
  notes: string[];
};

// ── 설명용 라벨/문구 매핑 (UI와 중복돼도 무방: 서버 측 설명 강화용)
const TRAIT_LABEL_KO: Record<Trait, string> = {
  social: "사회성/교류",
  novelty: "새로움/탐색",
  structure: "질서/안정",
  flexibility: "유연성/자유",
  sensory: "감각/자극",
  culture: "문화/역사",
};
const TRAIT_REASON_KO: Record<Trait, string> = {
  social: "현지 교류/가이드 투어처럼 대화가 많은 활동 선호",
  novelty: "새로운 동네·이색 콘텐츠 탐색에 만족도 높음",
  structure: "계획형 동선·정돈된 도시/교통 환경 선호",
  flexibility: "자유 일정·여유 있는 루트에서 컨디션 유지",
  sensory: "미식/야경/자연 등 감각 자극이 풍부할수록 좋음",
  culture: "역사·예술·전통 경험에서 큰 즐거움",
};
const ELEMENT_LABEL_KO: Record<Element, string> = {
  wood: "목(숲/정원)",
  fire: "화(축제/활기)",
  earth: "토(산/온천)",
  metal: "금(도시/질서)",
  water: "수(바다/하천)",
};
const ELEMENT_REASON_KO: Record<Element, string> = {
  wood: "숲·정원·트레킹 등 자연 녹지 비중을 높이면 잘 맞음",
  fire: "축제/야간 명소·활기찬 거리의 체류 시간이 맞음",
  earth: "산/온천·대지의 안정감을 주는 코스에서 회복",
  metal: "현대적 도시/건축/미술관 동선이 만족도를 끌어올림",
  water: "바다·강·온천 등 수변 동선을 넣으면 집중 회복",
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
  if (!input.birthDate) {
    notes.push("사주 미입력: MBTI 중심 추천");
  }
  // ‘출생 시간 모름’(birthTime 미전달)일 땐 안내를 넣지 않음.
  // 유효하지 않은 포맷이 명시적으로 전달된 “특수” 케이스에만 안내.
  if (input.birthDate && typeof input.birthTime === "string" && input.birthTime !== "" && !/^\d{2}:\d{2}$/.test(input.birthTime)) {
    notes.push("출생 시각 미상: 시간(시지) 영향 제외");
  }

  // ── MBTI/사주 설명 고도화: 상위 2개를 문장으로 요약해 notes 최상단에 추가
  if (mb.length) {
    const mbNames = mb.map(([k]) => TRAIT_LABEL_KO[k]).join(", ");
    const mbReasons = Array.from(new Set(mb.map(([k]) => TRAIT_REASON_KO[k]))).slice(0, 2).join(" · ");
    notes.unshift(`MBTI 성향(${mbNames}): ${mbReasons}.`);
  }
  if (input.birthDate && sj.length) {
    const sjNames = sj.map(([k]) => ELEMENT_LABEL_KO[k]).join(", ");
    const sjReasons = Array.from(new Set(sj.map(([k]) => ELEMENT_REASON_KO[k]))).slice(0, 2).join(" · ");
    notes.unshift(`사주 오행(${sjNames}): ${sjReasons}.`);
  }
  // 동반형태 힌트(있을 때만)
  if (input.companions === "family" && d.kidFriendly) notes.push("가족여행 친화(키즈/그룹 동선 용이)");
  if (input.companions === "couple" && ((d.nightlife ?? 0) + (d.languageEase ?? 0) > 1.0)) notes.push("커플여행: 야경/이동 용이");
  if (input.companions === "friends" && (d.groupEase ?? 0) > 0.6) notes.push("친구여행: 3~4인 동선/숙박 용이");
  notes.push(...budgetAdvice(d, input));
  return { mbtiTop: mb, sajuTop: sj, notes };
}

export type RecommendOpts = { limit?: number; dataset?: Destination[] };
export function recommend(input: UserInput, opt?: RecommendOpts) {
  const traits = mbtiToTraits(input.mbti);
  const elems = getElements(input);

  const hasDate = !!input.birthDate;
  const hasTime = !!input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime ?? "");
  const betaLocal = hasDate ? (hasTime ? W.beta : W.beta * 0.7) : 0; // 사주 미입력 → 오행 영향 0

  // ── 테스트 주입용 데이터셋(or 기본 전역 데이터)
  const source = opt?.dataset ?? destinations;

  // 1) region 필터
  const base =
    input.region && input.region !== "all"
      ? source.filter((d) => d.region === input.region)
      : [...source];

  let pool = base;

  // 예산 필터 적용 (strict 모드면 선택 레벨과 동일한 목적지만 남김)
  pool = pool.filter((d) => isBudgetAllowed(d, input));
  // Fallback: 결과가 0이면 완화
  if (pool.length === 0 && input.budgetLevel) {
    // 1단계: 같은 region 내 band(±1)
    const bandLocal = base.filter(
      (d) => Math.abs(d.budgetLevel - input.budgetLevel!) <= 1
    );
    if (bandLocal.length) {
      pool = bandLocal;
    } else {
      // 2단계: 같은 region 내 cap(사용자 레벨+1까지)
      const capLocal = base.filter(
        (d) => (d.budgetLevel - input.budgetLevel!) < 2
      );
      if (capLocal.length) {
        pool = capLocal;
      } else {
        // 3단계(마지막): region 무시하고 전역에서 band → cap 순
        const bandGlobal = source.filter(
          (d) => Math.abs(d.budgetLevel - input.budgetLevel!) <= 1
        );
        pool = bandGlobal.length
          ? bandGlobal
          : source.filter((d) => (d.budgetLevel - input.budgetLevel!) < 2);
      }
    }
  }

  // 2) 점수 계산 → 정렬(원시값) → 출력은 반올림
  const scored = pool.map((d) => {
    const comp = companionScore(d, input); // 0~1
    const cov  = companionCoverage(d);     // 0~1
    const compWeight = COMP_BONUS_BASE + COMP_BONUS_VAR * cov;    
    const scoreRaw =
      W.alpha * dot<Trait>(traits, d.traitProfile) +
      betaLocal * dot<Element>(elems, d.elementProfile) -
      W.gamma * penalty(d, input) +
      // 동반형태 가산(중립 0.5 기준 양/음 대칭) + 타이브레이커 소폭 반영
      compWeight * (comp - 0.5) +
      RANK_NUDGE * (comp - 0.5);
    return {
      destination: d,
      scoreRaw,
      explain: explain(d, traits, elems, input),
    };
  });

  // 점수 기준 정렬(이미 scoreRaw에 RANK_NUDGE 반영)
  scored.sort((a, b) => (b.scoreRaw - a.scoreRaw) || a.destination.id.localeCompare(b.destination.id));

  const limit = opt?.limit ?? 5;
  return scored.slice(0, limit).map(({ destination, scoreRaw, explain }) => ({
    destination,
    score: Number(scoreRaw.toFixed(4)),
    explain,
  }));
}

export function getPersonalization(input: UserInput): PersonalizationContext {
  const traits = mbtiToTraits(input.mbti);
  const { elements, pillars } = getElementsWithDetail(input);
  return { traits, elements, pillars };
}