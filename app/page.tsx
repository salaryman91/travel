"use client";

import { useState } from "react";
import type { MBTI, Destination, Trait, Element, RegionFilter, BudgetLevel } from "@/lib/types";

type BudgetChoice = { level: BudgetLevel; label: string; hint: string };

const MBTIS: MBTI[] = ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP","ISTJ","ISTP","ESTJ","ESTP","ISFJ","ISFP","ESFJ","ESFP"];

const BUDGET_CHOICES: BudgetChoice[] = [
  { level: 1, label: "₩200,000 이하",                         hint: "초절약 — 교통/무료활동 중심" },
  { level: 2, label: "₩200,000 초과 ~ ₩500,000 이하",         hint: "절약 — 2~3성, 가성비 맛집" },
  { level: 3, label: "₩500,000 초과 ~ ₩900,000 이하",         hint: "중간 — 3~4성, 대표 액티비티 1~2" },
  { level: 4, label: "₩900,000 초과 ~ ₩1,500,000 이하",       hint: "여유 — 4성+, 투어/스파" },
  { level: 5, label: "₩1,500,000 이상",                       hint: "프리미엄 — 5성/미쉐린/개별투어" },
];

type Result = {
  destination: Destination;
  score: number;
  explain: { mbtiTop: [Trait, number][], sajuTop: [Element, number][], notes: string[] };
};

// 한글 라벨 매핑
const TRAIT_LABEL_KO: Record<Trait, string> = {
  social: "사회성/교류",
  novelty: "새로움/탐색",
  structure: "질서/안정",
  flexibility: "유연성/자유",
  sensory: "감각/자극",
  culture: "문화/역사",
};
const ELEMENT_LABEL_KO: Record<Element, string> = {
  wood: "목(숲/정원)",
  fire: "화(축제/활기)",
  earth: "토(산/온천)",
  metal: "금(도시/질서)",
  water: "수(바다/하천)",
};

// 디버그 표시 플래그:
// - 로컬(dev)에서는 기본 ON
// - 프로덕션에서는 기본 OFF, 필요하면 NEXT_PUBLIC_DEBUG=true로 강제 ON
const SHOW_DEBUG =
  process.env.NEXT_PUBLIC_DEBUG === "true" || process.env.NODE_ENV !== "production";

// 목적지 카드에서도 동일한 예산 문구를 사용하기 위한 헬퍼
const budgetLabelFromLevel = (lvl: BudgetLevel) =>
  BUDGET_CHOICES.find((b) => b.level === lvl)?.label ?? `레벨 ${lvl}/5`;

export default function Page() {
  const [mbti, setMBTI] = useState<MBTI>(MBTIS[0]); // INTJ
  const [travelMonth, setMonth] = useState<number>(1);
  const [budgetLevel, setBudget] = useState<BudgetLevel>(1);
  const [companions, setComp] = useState<"solo"|"friends"|"family">("solo");
  const [region, setRegion] = useState<RegionFilter>("all");

  // 사주 입력 (MBTI 바로 아래)
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [birthTime, setBirthTime] = useState<string | undefined>(undefined);
  const [timeUnknown, setTimeUnknown] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [ctx, setCtx] = useState<{
    traits: Record<Trait, number>;
    elements: Record<Element, number>;
    pillars: { yearStem: string; yearBranch: string; monthStem: string; monthBranch: string; hourBranch: string; };
  } | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        mbti, travelMonth, budgetLevel, companions, region,
        birthDate,
        birthTime: timeUnknown ? undefined : birthTime,
      };
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setResults(json.results);
      setCtx(json.ctx);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold mb-6">MBTI × 사주 여행 추천 (MVP)</h1>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-4">
          {/* MBTI */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">MBTI</label>
            <select
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={mbti}
              onChange={(e) => setMBTI(e.target.value as MBTI)}
            >
              {MBTIS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* 사주 입력 */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="col-span-1 space-y-2">
              <label className="text-sm text-neutral-300">생년월일</label>
              <div className="relative">
                <input
                  type="date"
                  className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 pr-10 appearance-none tabular-nums"
                  value={birthDate ?? ""}
                  onChange={(e) => setBirthDate(e.target.value || undefined)}
                  placeholder="YYYY-MM-DD"
                />
                {/* custom calendar icon (same position as time icon) */}
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                     width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" />
                  <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" />
                </svg>
              </div>
            </div>
            <div className="col-span-1 space-y-2">
              <label className="text-sm text-neutral-300 flex items-center justify-between">
                <span>출생 시각</span>
                <span className="text-xs">
                  <input
                    id="time-unknown"
                    type="checkbox"
                    className="mr-1 align-middle"
                    checked={timeUnknown}
                    onChange={(e) => { setTimeUnknown(e.target.checked); if (e.target.checked) setBirthTime(undefined); }}
                  />
                  모름
                </span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 pr-10 appearance-none tabular-nums"
                  value={birthTime ?? ""}
                  onChange={(e) => setBirthTime(e.target.value || undefined)}
                  disabled={timeUnknown}
                  placeholder="HH:MM"
                />
                {/* custom clock icon (same position as date icon) */}
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                     width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" />
                  <path d="M12 7v5l3 2" stroke="currentColor" />
                </svg>
              </div>
            </div>
          </div>

          {/* 여행 월 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">여행 월</label>
            <select
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={travelMonth}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>

          {/* 예산 */}
          <div className="space-y-1">
            <label className="text-sm text-neutral-300">예산 (1인/3박4일, 항공 제외)</label>
            <select
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={budgetLevel}
              onChange={(e) => setBudget(Number(e.target.value) as BudgetLevel)}
            >
              {BUDGET_CHOICES.map(b => (
                <option key={b.level} value={b.level}>{b.label}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500">{BUDGET_CHOICES.find(b => b.level === budgetLevel)?.hint}</p>
          </div>

          {/* 동반 형태 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">동반 형태</label>
            <select
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={companions}
              onChange={(e) => setComp(e.target.value as "solo"|"friends"|"family")}
            >
              <option value="solo">혼자</option>
              <option value="friends">친구</option>
              <option value="family">가족</option>
            </select>
          </div>

          {/* 여행지 구분 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">여행지 구분</label>
            <select
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionFilter)}
            >
              <option value="all">전체</option>
              <option value="domestic">국내</option>
              <option value="overseas">해외</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-2 rounded-md bg-white text-black py-2 font-medium disabled:opacity-60"
          >
            {loading ? "계산 중…" : "추천 보기"}
          </button>
        </div>

        {/* 결과 — 디버그 정보(오행/간지)는 개발 모드에서만 노출 (중복 제거) */}
        {SHOW_DEBUG && (
          <div className="mt-6 space-y-2 text-xs text-neutral-400">
            {ctx && (
              <p>
                입력 오행: 목({ctx.elements.wood.toFixed(2)}), 화({ctx.elements.fire.toFixed(2)}),
                토({ctx.elements.earth.toFixed(2)}), 금({ctx.elements.metal.toFixed(2)}),
                수({ctx.elements.water.toFixed(2)}) · 간지 ({ctx.pillars.yearStem}{ctx.pillars.yearBranch} /
                {ctx.pillars.monthStem}{ctx.pillars.monthBranch} / {ctx.pillars.hourBranch})
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-4">
          {results.map((r) => (
            <div key={r.destination.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {r.destination.name}, {r.destination.country}
                </h3>
                {/* 점수도 사용자 혼동을 줄이려면 디버그 모드에서만 노출 권장 */}
                {SHOW_DEBUG && <span className="text-xs text-neutral-400">score {r.score}</span>}
              </div>
              {/* 디버그 정보(입력 예산/추천월/목적지 예산)는 개발 모드에서만 노출 */}
              {SHOW_DEBUG && (
                <>
                  <p className="text-sm text-neutral-400 mt-1">
                    입력 예산: {BUDGET_CHOICES.find((b) => b.level === budgetLevel)?.label}
                    {" · "}추천월: {r.destination.bestMonths?.join(", ") ?? "-"}
                    {" · "}{r.destination.region === "domestic" ? "국내" : "해외"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    목적지 예산: {
                      BUDGET_CHOICES.find((b) => b.level === r.destination.budgetLevel)?.label
                      ?? `레벨 ${r.destination.budgetLevel}/5`
                    } ({r.destination.budgetLevel}/5)
                  </p>
                </>
              )}
              <div className="mt-2 text-sm">
                <div className="font-medium">
                  추천 이유 — MBTI: {r.explain.mbtiTop.map(([k]) => TRAIT_LABEL_KO[k]).join(", ")},
                  {" "}사주: {r.explain.sajuTop.map(([k]) => ELEMENT_LABEL_KO[k]).join(", ")}
                </div>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  {r.explain.notes.map((n, i) => <li key={i} className="text-neutral-300">{n}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-neutral-600 mt-4">* 사주 정보는 엔터테인먼트/퍼스널라이즈드 목적이며, 입력값은 저장하지 않습니다.</p>
      </div>
      {/* native picker icons hidden for consistent padding/spacing */}
      <style jsx global>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 0; /* hide native icon */
          width: 0;
          height: 0;
        }
        /* remove spin buttons (some browsers) for time input */
        input[type="time"]::-webkit-inner-spin-button,
        input[type="time"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </main>
  );
}