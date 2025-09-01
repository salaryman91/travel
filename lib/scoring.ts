import { mbtiToTraits } from "./mbtiToTraits";
import { getElements, getElementsWithDetail } from "./sajuElements";
import { destinations } from "@/data/destinations";
import type {
  UserInput, Element, Trait, Destination, PersonalizationContext
} from "./types";

// ───────────────────────────────────────────────────────────
// 가중치
// ───────────────────────────────────────────────────────────
const W = {
  alpha: 0.50, // MBTI(특성) 코사인
  beta:  0.40, // 사주(오행) 코사인 (시간 미입력 시 자동 감쇠)
  gamma: 0.35, // 패널티 감산
  season: 1.00 // 시즌 독립항
};

// MBTI 살리언스 / 봉우리
const MBTI_SALIENCE = 1.35;
const MBTI_PEAK1 = 0.18;
const MBTI_PEAK2 = 0.10;

// MBTI 특화 보너스(올라운더 과점 완화)
const MBTI_SPEC_GAIN = 0.10;
const MBTI_SPEC_W1   = 0.6;
const MBTI_SPEC_W2   = 0.4;

// 동반형태 가산(표시·타이브레이크)
const COMP_BONUS_BASE = 0.18;
const COMP_BONUS_VAR  = 0.24;
const RANK_NUDGE      = 0.03;

// 동반형태→Trait 블렌드(코사인에도 반영)
const CTB = 0.18;

// 거리(비행시간) — 현 시점 OFF
const logistic = (x: number, k = 0.8, x0 = 1) => 1 / (1 + Math.exp(-k * (x - x0)));
const DISTANCE_PENALTY_ENABLED = false;

// 예산 필터 모드
type BudgetFilterMode = "strict" | "band" | "cap";
const BUDGET_FILTER_MODE: BudgetFilterMode = "strict";

// Trait 키 고정
const TRAIT_KEYS: Trait[] = ["social","novelty","structure","flexibility","sensory","culture"];

// ───────────────────────────────────────────────────────────
// 프레젠테이션 지표 임계 & 함수
// ───────────────────────────────────────────────────────────
const MIN_CLOSENESS = 0.05; // top 대비 5% 미만은 숨김
const MIN_SHARE     = 0.01; // softmax share 1% 미만은 숨김
const SOFTMAX_T     = 0.08; // 온도(작을수록 차이 강조)

// 소프트맥스 비중
function softmaxShares(scores: number[], T = SOFTMAX_T): number[] {
  if (!scores.length) return [];
  const m = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - m) / Math.max(1e-6, T)));
  const Z = exps.reduce((a,b)=>a+b, 0) || 1;
  return exps.map(e => e / Z);
}

// 근접도→등급
function tierFromCloseness(c: number): "S"|"A"|"B"|"C"|"D" {
  if (c >= 0.90) return "S";
  if (c >= 0.78) return "A";
  if (c >= 0.64) return "B";
  if (c >= 0.50) return "C";
  return "D";
}

// 인덱스→퍼센타일(0=최상위, 100=최하위)
function percentileFromIndex(idx: number, n: number): number {
  if (n <= 1) return 0;
  return Math.round((idx) / (n - 1) * 100);
}

// ───────────────────────────────────────────────────────────
// 유틸
// ───────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function enhanceSalienceTraits<T extends string>(t: Record<T, number>): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of Object.keys(t) as T[]) {
    const v = t[k];
    out[k] = clamp01(0.5 + (v - 0.5) * MBTI_SALIENCE);
  }
  return out;
}

function boostTopTraits<T extends string>(t: Record<T, number>): Record<T, number> {
  const entries = Object.entries(t) as [T, number][];
  entries.sort((a,b)=>b[1]-a[1]);
  const [k1] = entries[0] ?? [];
  const [k2] = entries[1] ?? [];
  const out = { ...t };
  if (k1) out[k1] = clamp01(out[k1] * (1 + MBTI_PEAK1));
  if (k2) out[k2] = clamp01(out[k2] * (1 + MBTI_PEAK2));
  return out;
}

function isBudgetAllowed(d: Destination, i: UserInput) {
  if (!i.budgetLevel) return true;
  const delta = d.budgetLevel - i.budgetLevel;
  switch (BUDGET_FILTER_MODE) {
    case "strict": return delta === 0;
    case "band":   return Math.abs(delta) <= 1;
    case "cap":
    default:       return delta < 2;
  }
}

// 코사인 유사도
const cosine = <K extends string>(
  a: Partial<Record<K, number>>,
  b: Partial<Record<K, number>>
) => {
  const keys = new Set<string>([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);
  let dot = 0, aa = 0, bb = 0;
  for (const k of keys) {
    const av = (a[k as K] ?? 0);
    const bv = (b[k as K] ?? 0);
    dot += av * bv;
    aa  += av * av;
    bb  += bv * bv;
  }
  const denom = Math.sqrt(aa) * Math.sqrt(bb);
  return denom > 0 ? (dot / denom) : 0;
};

// 동반형태 점수(표시·타이브레이크)
function companionScore(d: Destination, i: UserInput): number {
  const c = i.companions;
  if (!c) return 0.5;
  let s = 0, n = 0;
  const push = (v?: number, w = 1) => { if (typeof v === "number") { s += v * w; n += w; } };
  const bump = (ok: boolean, v = 0.2) => { if (ok) { s += v; } };
  push(d.safetyIndex,  c === "solo" ? 1.2 : 0.8);
  push(d.accessEase,   c === "solo" ? 1.0 : 0.8);
  push(d.groupEase,   (c === "friends" || c === "family") ? 1.2 : 0.6);
  push(d.nightlife,   (c === "friends" || c === "couple") ? 1.1 : 0.5);
  push(d.languageEase, 0.8);
  bump(!!d.kidFriendly && c === "family", 0.2);
  bump(!!d.suitableFor?.includes(c), 0.2);
  return n === 0 ? 0.5 : clamp01(s / n);
}

// 동반형태 커버리지
function companionCoverage(d: Destination): number {
  const fields: Array<keyof Destination> = [
    "safetyIndex","accessEase","languageEase","nightlife","groupEase"
  ];
  let filled = 0;
  for (const k of fields) if (typeof (d as any)[k] === "number") filled++;
  if (typeof (d as any).kidFriendly === "boolean") filled += 0.5;
  if (Array.isArray((d as any).suitableFor))       filled += 0.5;
  const max = fields.length + 1;
  return clamp01(filled / max);
}

// companions → trait 초점 벡터
const COMPANION_TRAIT_BIAS: Record<NonNullable<UserInput["companions"]>, Record<Trait, number>> = {
  solo:    { social:0.2, novelty:0.1, structure:0.40, flexibility:0.10, sensory:0.05, culture:0.15 },
  couple:  { social:0.25, novelty:0.10, structure:0.10, flexibility:0.15, sensory:0.30, culture:0.10 },
  friends: { social:0.35, novelty:0.20, structure:0.05, flexibility:0.25, sensory:0.10, culture:0.05 },
  family:  { social:0.10, novelty:0.05, structure:0.35, flexibility:0.15, sensory:0.10, culture:0.25 },
};

function blendTraitsWithCompanion(
  mbtiTraits: Record<Trait, number>,
  companions?: UserInput["companions"]
): Record<Trait, number> {
  if (!companions) return mbtiTraits;
  const bias = COMPANION_TRAIT_BIAS[companions];
  const out: Record<Trait, number> = { ...mbtiTraits };
  for (const k of TRAIT_KEYS) {
    const t = mbtiTraits[k] ?? 0.5;
    const b = bias[k] ?? 0.1667;
    out[k] = clamp01((1 - CTB) * t + CTB * b);
  }
  return out;
}

// 시즌 독립 조정(가산/감산) + 특이성 가중
const SEASON_BONUS     = 0.08;
const SEASON_PEN_NEAR  = 0.10;
const SEASON_PEN_FAR   = 0.22;
function monthDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}
function seasonAdjust(d: Destination, i: UserInput): number {
  if (!i.travelMonth || !d.bestMonths?.length) return 0;
  const specificity = clamp01(1 - d.bestMonths.length / 12);
  const inBest = d.bestMonths.includes(i.travelMonth);
  if (inBest) return +W.season * SEASON_BONUS * (0.6 + 0.4 * specificity);
  const near = d.bestMonths.some(m => monthDistance(m, i.travelMonth!) === 1);
  return -W.season * (near ? SEASON_PEN_NEAR : SEASON_PEN_FAR) * (0.5 + 0.5 * specificity);
}

// 패널티(시즌 제외)
const penalty = (d: Destination, i: UserInput) => {
  let p = 0;
  if (i.budgetLevel) {
    const over = Math.max(0, d.budgetLevel - i.budgetLevel);
    if (over > 0) p += 0.55 * over;
    const under = Math.max(0, i.budgetLevel - d.budgetLevel);
    if (under > 0) p -= 0.06 * under;
  }
  if (i.companions === "solo") {
    const safe = (d.traitProfile.structure ?? 0) + (d.traitProfile.culture ?? 0);
    p -= 0.08 * safe;
  }
  if (DISTANCE_PENALTY_ENABLED && typeof i.maxFlightHours === "number" && typeof d.avgFlightHoursFromICN === "number") {
    const diff = d.avgFlightHoursFromICN - i.maxFlightHours;
    if (diff > 0) p += 0.25 * logistic(diff, 0.8, 1);
  }
  return Math.max(0, Math.min(1, p));
};

type Explain = {
  mbtiTop: [Trait, number][],
  sajuTop: [Element, number][],
  notes: string[],
};

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
): { mbtiTop: [Trait, number][], sajuTop: [Element, number][], notes: string[] } {
  const mb = top2(traits);
  const sj = top2(elems);
  const notes = [...(d.notes ?? [])];
  if (!input.birthDate) {
    notes.push("MBTI 중심 추천");
  }
  if (input.birthDate && typeof input.birthTime === "string" && input.birthTime !== "" && !/^\d{2}:\d{2}$/.test(input.birthTime)) {
    notes.push("출생 시각 미상: 시간(시지) 영향 제외");
  }
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
  if (input.companions === "family" && d.kidFriendly) notes.push("가족여행 친화(키즈/그룹 동선 용이)");
  if (input.companions === "couple" && ((d.nightlife ?? 0) + (d.languageEase ?? 0) > 1.0)) notes.push("커플여행: 야경/이동 용이");
  if (input.companions === "friends" && (d.groupEase ?? 0) > 0.6) notes.push("친구여행: 3~4인 동선/숙박 용이");
  notes.push(...budgetAdvice(d, input));
  return { mbtiTop: mb, sajuTop: sj, notes };
}

// MBTI 특화 보너스
function mbtiSpecializationBonus(
  mbtiTraits: Record<Trait, number>,
  d: Destination
): number {
  const [t1, v1] = top2(mbtiTraits)[0] ?? ["social", 0.5];
  const [t2, v2] = top2(mbtiTraits)[1] ?? ["novelty", 0.5];
  const mean =
    TRAIT_KEYS.reduce((s, k) => s + (d.traitProfile[k] ?? 0), 0) / TRAIT_KEYS.length;
  const topAvg =
    MBTI_SPEC_W1 * (d.traitProfile[t1] ?? 0) +
    MBTI_SPEC_W2 * (d.traitProfile[t2] ?? 0);
  const centered = (topAvg - mean);
  const mbtiConfidence = ((Math.abs(v1 - 0.5) + Math.abs(v2 - 0.5)) / 2);
  return MBTI_SPEC_GAIN * centered * (0.6 + 0.4 * mbtiConfidence);
}

// Variety & Country Balance Guard
const VARIETY_JITTER = 0.05;
const COUNTRY_BALANCER_MAX = 0.06;

function stableHash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function applyVarietyAndCountryBalance<T extends { destination: Destination; scoreRaw: number }>(
  rows: T[],
  input: UserInput,
  datasetForCountryCount: Destination[],
): T[] {
  if (!rows?.length) return rows;

  const byCountry = new Map<string, number>();
  for (const d of datasetForCountryCount) {
    byCountry.set(d.country, (byCountry.get(d.country) ?? 0) + 1);
  }

  for (const r of rows) {
    const key = `${input.mbti}|${input.companions}|${r.destination.id}`;
    const jitter = (stableHash01(key) - 0.5) * 2 * VARIETY_JITTER; // [-J,+J]
    r.scoreRaw += jitter;

    if (input.region !== "domestic") {
      const cnt = byCountry.get(r.destination.country) ?? 1;
      const penalty = Math.min(COUNTRY_BALANCER_MAX, Math.max(0, 0.02 * (cnt - 1)));
      r.scoreRaw -= penalty;
    }
  }
  return rows;
}

export type RecommendOpts = {
  limit?: number;
  dataset?: Destination[];
  minCloseness?: number; // 기본값 MIN_CLOSENESS
  minShare?: number;     // 기본값 MIN_SHARE
};

export function recommend(input: UserInput, opt?: RecommendOpts) {
  // 1) MBTI 쿼리 벡터
  const mbtiBase = boostTopTraits(enhanceSalienceTraits(mbtiToTraits(input.mbti)));
  const traits   = blendTraitsWithCompanion(mbtiBase, input.companions);

  // 2) 사주(오행)
  const elems = getElements(input);
  const hasDate = !!input.birthDate;
  const hasTime = !!input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime ?? "");
  const betaLocal = hasDate ? (hasTime ? W.beta : W.beta * 0.7) : 0;

  // 3) 데이터셋 / region / 예산 필터(+fallback)
  const source = opt?.dataset ?? destinations;
  const base =
    input.region && input.region !== "all"
      ? source.filter((d) => d.region === input.region)
      : [...source];

  let pool = base.filter((d) => isBudgetAllowed(d, input));
  if (pool.length === 0 && input.budgetLevel) {
    const bandLocal = base.filter((d) => Math.abs(d.budgetLevel - input.budgetLevel!) <= 1);
    if (bandLocal.length) {
      pool = bandLocal;
    } else {
      const capLocal = base.filter((d) => (d.budgetLevel - input.budgetLevel!) < 2);
      if (capLocal.length) {
        pool = capLocal;
      } else {
        const bandGlobal = source.filter((d) => Math.abs(d.budgetLevel - input.budgetLevel!) <= 1);
        pool = bandGlobal.length ? bandGlobal : source.filter((d) => (d.budgetLevel - input.budgetLevel!) < 2);
      }
    }
  }

  // 4) 점수 계산
  const scored = pool.map((d) => {
    const comp = companionScore(d, input);
    const cov  = companionCoverage(d);
    const compWeight = COMP_BONUS_BASE + COMP_BONUS_VAR * cov;
    const season = seasonAdjust(d, input);
    const spec   = mbtiSpecializationBonus(mbtiBase, d);

    const scoreRaw =
      W.alpha * cosine<Trait>(traits, d.traitProfile) +
      betaLocal * cosine<Element>(elems, d.elementProfile) -
      W.gamma * penalty(d, input) +
      compWeight * (comp - 0.5) +
      RANK_NUDGE * (comp - 0.5) +
      season +
      spec;

    return { destination: d, scoreRaw, explain: explain(d, traits, elems, input) };
  });

  // 5) 리랭크 → 정렬
  applyVarietyAndCountryBalance(scored, input, base);
  scored.sort((a, b) => (b.scoreRaw - a.scoreRaw) || a.destination.id.localeCompare(b.destination.id));

  // 6) 프레젠테이션 지표 계산
  const top = scored[0]?.scoreRaw ?? 0;
  const closeness = scored.map(r => (top > 0 ? r.scoreRaw / top : 0));
  const shares = softmaxShares(scored.map(r => r.scoreRaw), SOFTMAX_T);

  const withMeta = scored.map((r, i) => {
    const c = closeness[i];
    const share = shares[i];
    const tier = tierFromCloseness(c);
    const percentile = percentileFromIndex(i, scored.length);
    return { ...r, closeness: c, share, tier, percentile };
  });

  // 7) 미노출 규칙 적용(전부 사라지면 안전하게 원본 유지)
  const minC = opt?.minCloseness ?? MIN_CLOSENESS;
  const minS = opt?.minShare ?? MIN_SHARE;
  const filtered = withMeta.filter(r => r.closeness > minC && r.share > minS);
  const finalRows = filtered.length ? filtered : withMeta;

  const limit = opt?.limit ?? 5;
  return finalRows.slice(0, limit).map(({ destination, scoreRaw, tier, share, percentile, explain }) => ({
    destination,
    score: scoreRaw,  // 내부 정렬/디버깅용
    tier,             // "S" | "A" | "B" | "C" | "D"
    share,            // 0~1 (상위 후보군 내 비중)
    percentile,       // 0=최상위
    explain,
  }));
}

export function getPersonalization(input: UserInput): PersonalizationContext {
  const traits = mbtiToTraits(input.mbti);
  const { elements, pillars } = getElementsWithDetail(input);
  return { traits, elements, pillars };
}