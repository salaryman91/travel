// app/page.tsx
"use client";

import { useState } from "react";
import type {
  MBTI,
  Destination,
  Trait,
  Element,
  RegionFilter,
  BudgetLevel,
  Companion,
} from "@/lib/types";
type Tier = "S"|"A"|"B"|"C"|"D";

type BudgetChoice = { level: BudgetLevel; label: string; hint: string };

const MBTIS: MBTI[] = [
  "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISTP","ESTJ","ESTP","ISFJ","ISFP","ESFJ","ESFP"
];

const BUDGET_CHOICES: BudgetChoice[] = [
  { level: 1, label: "₩200,000 이하",                   hint: "초절약 — 교통/무료활동 중심" },
  { level: 2, label: "₩200,000 초과 ~ ₩500,000 이하",   hint: "절약 — 2~3성, 가성비 맛집" },
  { level: 3, label: "₩500,000 초과 ~ ₩900,000 이하",   hint: "중간 — 3~4성, 대표 액티비티 1~2" },
  { level: 4, label: "₩900,000 초과 ~ ₩1,500,000 이하", hint: "여유 — 4성+, 투어/스파" },
  { level: 5, label: "₩1,500,000 이상",                 hint: "프리미엄 — 5성/미쉐린/개별투어" },
];

type Result = {
  destination: Destination;
  // 서버 반환 메타 (scoring.ts 완성본 기준)
  score: number;        // 내부 원점수(디버그/정렬 참고용)
  tier: Tier;           // "S" | "A" | "B" | "C" | "D"
  share: number;        // 0~1 (상위 후보군 내 소프트맥스 비중)
  percentile: number;   // 0=최상위, 100=최하위
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
// - 로컬(dev) 기본 ON, 프로덕션 기본 OFF (원하면 NEXT_PUBLIC_DEBUG=true로 강제 ON)
const SHOW_DEBUG =
  process.env.NEXT_PUBLIC_DEBUG === "true" || process.env.NODE_ENV !== "production";

export default function Page() {
  const [error, setError] = useState<string | null>(null);
  const [mbti, setMBTI] = useState<MBTI>(MBTIS[0]); // INTJ
  const [travelMonth, setMonth] = useState<number>(1);
  const [budgetLevel, setBudget] = useState<BudgetLevel>(1);
  const [companions, setComp] = useState<Companion>("solo");
  const [region, setRegion] = useState<RegionFilter>("all");

  // 사주 입력 — DOB 3분할
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [dobY, setDobY] = useState<string>("");
  const [dobM, setDobM] = useState<string>("");
  const [dobD, setDobD] = useState<string>("");

  // 출생 시각: AM/PM 드롭다운 + 시/분 입력
  const [birthTime, setBirthTime] = useState<string | undefined>(undefined);
  const [amPm, setAmPm] = useState<"AM" | "PM">("AM");
  const [hour12, setHour12] = useState<string>("");   // 1~12
  const [minute, setMinute] = useState<string>("");   // 0~59
  const [timeUnknown, setTimeUnknown] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  // 12시간 표기를 HH:MM(24시간)으로 변환
  const updateBirthTimeFromParts = (ap: "AM"|"PM", hStr: string, mStr: string, unknown: boolean) => {
    if (unknown) { setBirthTime(undefined); return; }
    const h = Math.min(12, Math.max(1, parseInt(hStr || "0", 10)));
    const m = Math.min(59, Math.max(0, parseInt(mStr || "0", 10)));
    if (!Number.isFinite(h) || h < 1 || h > 12) { setBirthTime(undefined); return; }
    let h24 = h % 12;
    if (ap === "PM") h24 += 12;
    const hh = String(h24).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    setBirthTime(`${hh}:${mm}`);
  };

  const handleSubmit = async () => {
    // 간단 가드: 연/월/일 중 일부만 채운 상태 방지
    if ((dobY || dobM || dobD) && !(dobY && dobM && dobD)) {
      setError("생년월일은 연·월·일을 모두 입력해야 합니다.");
      return;
    }
    setLoading(true); setError(null);
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
      if (!res.ok) {
         let msg = `요청 실패(${res.status})`;
         try {
           const err = await res.json();
           if (err?.issues) msg += " - " + JSON.stringify(err.issues).slice(0,200);
         } catch {
           const t = await res.text();
           msg += " " + t.slice(0,140);
         }
         throw new Error(msg);
      }
      const json = await res.json();
      const arr: Result[] = json.results ?? [];
      setResults(arr);

      setCtx(json.ctx);
    } catch (e:any) {
      setResults([]); setCtx(null);
      setError(e?.message ?? "요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const [ctx, setCtx] = useState<{
    traits: Record<Trait, number>;
    elements: Record<Element, number>;
    pillars: {
      yearStem: string; yearBranch: string;
      monthStem: string; monthBranch: string;
      hourBranch: string;
    };
  } | null>(null);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold mb-6">MBTI × 사주 결합 여행지 추천</h1>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-4">
          {/* MBTI */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">MBTI</label>
            <div className="relative">
              <select
                className="w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={mbti}
                onChange={(e) => setMBTI(e.target.value as MBTI)}
              >
                {MBTIS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {/* ▼ 화살표 */}
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          {/* 사주 입력 */}
          <div className="grid grid-cols-2 gap-3 items-end">
            {/* 생년월일(3분할) */}
            <div className="col-span-1 space-y-2">
              <label className="text-sm text-neutral-300">생년월일</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  placeholder="YYYY"
                  className="h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 tabular-nums"
                  value={dobY}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0,4);
                    setDobY(v);
                    const mm = dobM.padStart(2,"0");
                    const dd = dobD.padStart(2,"0");
                    setBirthDate(v && dobM && dobD ? `${v}-${mm}-${dd}` : undefined);
                  }}
                  autoComplete="bday-year"
                />
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={2}
                  placeholder="MM"
                  className="h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 tabular-nums"
                  value={dobM}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0,2);
                    setDobM(v);
                    const yy = dobY;
                    const dd = dobD.padStart(2,"0");
                    setBirthDate(yy && v && dobD ? `${yy}-${v.padStart(2,"0")}-${dd}` : undefined);
                  }}
                  autoComplete="bday-month"
                />
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={2}
                  placeholder="DD"
                  className="h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 tabular-nums"
                  value={dobD}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0,2);
                    setDobD(v);
                    const yy = dobY;
                    const mm = dobM.padStart(2,"0");
                    setBirthDate(yy && dobM && v ? `${yy}-${mm}-${v.padStart(2,"0")}` : undefined);
                  }}
                  autoComplete="bday-day"
                />
              </div>
              {(dobY || dobM || dobD) && !(dobY && dobM && dobD) && (
                <p className="text-xs text-amber-400 mt-1">연·월·일을 모두 입력해주세요.</p>
              )}
            </div>

            {/* 출생 시각: AM/PM 드롭다운 + 시/분 입력 */}
            <div className="col-span-1 space-y-2">
              <label className="text-sm text-neutral-300 flex items-center justify-between">
                <span>출생 시각</span>
                <span className="text-xs">
                  <input
                    id="time-unknown"
                    type="checkbox"
                    className="mr-1 align-middle"
                    checked={timeUnknown}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTimeUnknown(checked);
                      if (checked) {
                        setBirthTime(undefined);
                      } else {
                        updateBirthTimeFromParts(amPm, hour12, minute, false);
                      }
                    }}
                  />
                  모름
                </span>
              </label>
              <div className={`grid grid-cols-3 gap-2 ${timeUnknown ? "opacity-50" : ""}`} aria-disabled={timeUnknown}>
                <div className="relative">
                  <select
                    disabled={timeUnknown}
                    className="h-10 w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 disabled:opacity-50"
                    value={amPm}
                    onChange={(e) => {
                      const v = e.target.value as "AM"|"PM";
                      setAmPm(v);
                      updateBirthTimeFromParts(v, hour12, minute, false);
                    }}
                  >
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                       width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1} max={12}
                  placeholder="시"
                  disabled={timeUnknown}
                  className="h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 tabular-nums"
                  value={hour12}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const v = raw === "" ? "" : String(Math.min(12, Math.max(1, parseInt(raw, 10))));
                    setHour12(v);
                    if (v !== "") updateBirthTimeFromParts(amPm, v, minute, false);
                    else setBirthTime(undefined);
                  }}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0} max={59}
                  placeholder="분"
                  disabled={timeUnknown}
                  className="h-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 tabular-nums"
                  value={minute}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const v = raw === "" ? "" : String(Math.min(59, Math.max(0, parseInt(raw, 10))));
                    setMinute(v);
                    if (v !== "" && hour12 !== "") updateBirthTimeFromParts(amPm, hour12, v, false);
                  }}
                />
              </div>
            </div>
          </div>

          {/* 여행 월 — 드롭다운(1~12월) */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">여행 월</label>
            <div className="relative">
              <select
                className="w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={travelMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          {/* 예산 */}
          <div className="space-y-1">
            <label className="text-sm text-neutral-300">예산 (1인/3박4일, 항공 제외)</label>
            <div className="relative">
              <select
                className="w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={budgetLevel}
                onChange={(e) => setBudget(Number(e.target.value) as BudgetLevel)}
              >
                {BUDGET_CHOICES.map(b => (
                  <option key={b.level} value={b.level}>{b.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            <p className="text-xs text-neutral-500">
              {BUDGET_CHOICES.find(b => b.level === budgetLevel)?.hint}
            </p>
          </div>

          {/* 동반 형태 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">동반 형태</label>
            <div className="relative">
              <select
                className="w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={companions}
                onChange={(e) => setComp(e.target.value as Companion)}
              >
                <option value="solo">혼자</option>
                <option value="couple">커플</option>
                <option value="friends">친구</option>
                <option value="family">가족</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          {/* 여행지 구분 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">여행지 구분</label>
            <div className="relative">
              <select
                className="w-full appearance-none pr-10 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionFilter)}
              >
                <option value="all">전체</option>
                <option value="domestic">국내</option>
                <option value="overseas">해외</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-2 rounded-md bg-white text-black py-2 font-medium disabled:opacity-60"
          >
            {loading ? "계산 중…" : "추천 여행지 보기"}
          </button>

          {/* 에러 배너 */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-3 rounded-md border border-rose-800 bg-rose-900/40 px-3 py-2 text-sm text-rose-100"
            >
              {error}
            </div>
          )}
        </div>

        {/* 결과 — 디버그 정보(오행/간지)는 개발 모드에서만 노출 */}
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
          {results.map((r, i) => {

            return (
              <div key={r.destination.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {r.destination.name}, {r.destination.country}
                  </h3>
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-white text-black">
                    추천 등급 {r.tier}
                  </span>
                </div>

                {/* (progress bar removed) */}

                {/* 디버그: 입력 예산/추천월/목적지 예산 */}
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
                    <p className="text-xs text-neutral-500 mt-1">
                      (debug) score {r.score.toFixed(4)}
                    </p>                    
                  </>
                )}

                <div className="mt-2 text-sm">
                  <div className="font-medium">
                    추천 이유 — MBTI: {r.explain.mbtiTop.map(([k]) => TRAIT_LABEL_KO[k]).join(", ")},
                    {" "}사주: {r.explain.sajuTop.map(([k]) => ELEMENT_LABEL_KO[k]).join(", ")}
                  </div>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5">
                    {r.explain.notes.map((n, idx) => <li key={idx} className="text-neutral-300">{n}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-neutral-600 mt-4">
          * 사주 정보는 엔터테인먼트/퍼스널라이즈드 목적이며, 입력값은 저장하지 않습니다.
        </p>
      </div>

      {/* 네이티브 select 화살표 숨기기 + 커스텀 화살표 사용 */}
      <style jsx global>{`
        select { appearance: none; -webkit-appearance: none; -moz-appearance: none; }
        select::-ms-expand { display: none; }
      `}</style>
    </main>
  );
}