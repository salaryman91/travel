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
import BirthDateTime, { type BirthValue } from "@/components/forms/BirthDateTime";

/**
 * 페이지 컴포넌트 역할
 * - MBTI/사주/여행월/예산/동반형태/지역 입력 폼
 * - 서버 API(/api/recommend) 호출 → 추천 결과 렌더링
 * - 접근성: label, role="alert", aria-live로 오류/상태 안내
 */

type Tier = "S" | "A" | "B" | "C" | "D";
type BudgetChoice = { level: BudgetLevel; label: string; hint: string };

/* ────────────────────────────────────────────────────────────
   상수/리스트: 폼 드롭다운 옵션(클라이언트만 사용)
   - 서버 스키마와 값(문자열) 일치 유지
   ──────────────────────────────────────────────────────────── */
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

/**
 * 추천 결과 타입 (서버 응답 구조에 맞춤)
 * - explain: 추천 이유(설명 가능성 확보)
 */
type Result = {
  destination: Destination;
  score: number;
  tier: Tier;
  share: number;
  percentile: number;
  explain: { mbtiTop: [Trait, number][], sajuTop: [Element, number][], notes: string[] };
};

/* UI 라벨 매핑: 사용자 읽기 쉬운 한국어 표기 */
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

/**
 * 디버그 플래그
 * - 프로덕션이 아니거나 NEXT_PUBLIC_DEBUG=true이면 내부 수치 표시
 * - 민감정보 포함 없음(안심 표출)
 */
const SHOW_DEBUG =
  process.env.NEXT_PUBLIC_DEBUG === "true" || process.env.NODE_ENV !== "production";

export default function Page() {
  /* ──────────────────────────────────────────────────────────
     로컬 상태: 폼 입력값, 로딩/오류, 서버 응답
     - BirthDateTime 컴포넌트는 { birthDate, birthTime, timeUnknown }를 관리
     ────────────────────────────────────────────────────────── */
  const [error, setError] = useState<string | null>(null);
  const [mbti, setMBTI] = useState<MBTI>(MBTIS[0]);
  const [travelMonth, setMonth] = useState<number>(1);
  const [budgetLevel, setBudget] = useState<BudgetLevel>(1);
  const [companions, setComp] = useState<Companion>("solo");
  const [region, setRegion] = useState<RegionFilter>("all");

  const [bd, setBd] = useState<BirthValue>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [ctx, setCtx] = useState<{
    traits: Record<Trait, number>;
    elements: Record<Element, number>;
    pillars: {
      yearStem: string; yearBranch: string;
      monthStem: string; monthBranch: string;
      hourBranch: string;
    };
  } | null>(null);

  /**
   * 제출 핸들러
   * 1) birthTime: '모름'이면 필드 자체를 전송하지 않음(서버 스키마가 string 타입)
   * 2) /api/recommend POST → ok 아니면 상세 메시지 파싱
   * 3) 결과/컨텍스트 상태 업데이트, 오류 알림
   */
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // 모름일 땐 birthTime을 아예 보내지 않음(서버 스키마가 string만 허용)
      const payload: any = {
        mbti, travelMonth, budgetLevel, companions, region,
        ...(bd.birthDate ? { birthDate: bd.birthDate } : {}),
      };
      if (!bd.timeUnknown && bd.birthTime) {
        payload.birthTime = bd.birthTime; // HH:mm
      }

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // HTTP 에러 처리: Zod issues 또는 error 메시지를 최대 200자만 표시
      if (!res.ok) {
        let msg = `요청 실패(${res.status})`;
        try {
          const err = await res.json();
          if (err?.issues) msg += " - " + JSON.stringify(err.issues).slice(0, 200);
          else if (err?.error) msg += " - " + String(err.error).slice(0, 200);
        } catch {
          const t = await res.text();
          msg += " " + t.slice(0, 140);
        }
        throw new Error(msg);
      }

      // 정상 응답: 결과/컨텍스트 상태 갱신
      const json = await res.json();
      setResults(json.results ?? []);
      setCtx(json.ctx ?? null);
    } catch (e: any) {
      // 실패 시: 결과 초기화 + 사용자 친화적 오류 메시지
      setResults([]); setCtx(null);
      setError(e?.message ?? "요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────
     렌더링
     - select.form-select: globals.css의 네이티브 선택 UI 커스텀 클래스 사용
     - 화살표는 SVG(포인터 이벤트 비활성)로 오버레이
     - 버튼 disabled 상태는 시각적 피드백 + 중복 요청 방지
     ────────────────────────────────────────────────────────── */
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
                className="form-select w-full appearance-none pr-10 bg-neutral-900 border border-neutral-700 text-white"
                value={mbti}
                onChange={(e) => setMBTI(e.target.value as MBTI)}
              >
                {MBTIS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {/* 커스텀 드롭다운 화살표 (접근성: aria-hidden) */}
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          {/* 사주 입력 (생년월일/출생시간/모름 처리) */}
          <BirthDateTime value={bd} onChange={setBd} />

          {/* 여행 월 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">여행 월</label>
            <div className="relative">
              <select
                className="form-select w-full appearance-none pr-10 bg-neutral-900 border border-neutral-700 text-white"
                value={travelMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
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
            <label className="text-sm text-neutral-300">예산 (1인/3박4일 기준, 항공권 제외)</label>
            <div className="relative">
              <select
                className="form-select w-full appearance-none pr-10 bg-neutral-900 border border-neutral-700 text-white"
                value={budgetLevel}
                onChange={(e) => setBudget(Number(e.target.value) as BudgetLevel)}
              >
                {BUDGET_CHOICES.map((b) => (
                  <option key={b.level} value={b.level}>{b.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            {/* 현재 선택된 예산 레벨의 상세 힌트 */}
            <p className="text-xs text-neutral-500">
              {BUDGET_CHOICES.find((b) => b.level === budgetLevel)?.hint}
            </p>
          </div>

          {/* 동반 형태 */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">동반 형태</label>
            <div className="relative">
              <select
                className="form-select w-full appearance-none pr-10 bg-neutral-900 border border-neutral-700 text-white"
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
                className="form-select w-full appearance-none pr-10 bg-neutral-900 border border-neutral-700 text-white"
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

          {/* 제출 버튼: 로딩 시 비활성화 */}
          <button
            data-testid="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-2 rounded-md bg-white text-black py-2 font-medium disabled:opacity-60"
          >
            {loading ? "계산 중…" : "추천 여행지 보기"}
          </button>

          {/* 에러 알림(스크린리더 즉시 읽기) */}
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

        {/* 디버그: 입력 가중치/간지 표기 (개발/디버그 모드 전용) */}
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

        {/* 결과 리스트: 설명 가능성 강조(추천 이유, 노트) */}
        <div className="mt-3 space-y-4">
          {results.map((r) => {
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

                {/* 개발/디버그 정보: 예산 라벨·추천월·지역·내부 score */}
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
                    추천 이유 — MBTI: {r.explain.mbtiTop.map(([k]) => TRAIT_LABEL_KO[k]).join(", ")}{" "}
                    사주: {r.explain.sajuTop.map(([k]) => ELEMENT_LABEL_KO[k]).join(", ")}
                  </div>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5">
                    {r.explain.notes.map((n, idx) => (
                      <li key={idx} className="text-neutral-300">{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* 개인정보 비저장 안내(법/윤리적 고지) */}
        <p className="text-[11px] text-neutral-600 mt-4">
          * 사주 정보는 엔터테인먼트/퍼스널라이즈드 목적이며, 입력값은 저장하지 않습니다.
        </p>
      </div>

      {/* 네이티브 select 화살표 숨기기 + 커스텀 화살표 사용
         - 브라우저 기본 화살표 비표시(접근성 영향 없음, 키보드/스크린리더 정상) */}
      <style jsx global>{`
        select { appearance: none; -webkit-appearance: none; -moz-appearance: none; }
        select::-ms-expand { display: none; }
      `}</style>
    </main>
  );
}