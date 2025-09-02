"use client";

import { useEffect, useMemo, type ReactNode } from "react";

/**
 * BirthValue
 * - 폼의 내부 상태(shape)와 서버 전송값을 동시에 관리
 * - birthDate: YYYY-MM-DD (세 선택값이 모두 유효할 때만 생성)
 * - birthTime: HH:mm(24h). '모름'이면 필드 자체를 만들지 않음(undefined 유지)
 * - year/month/day/ampm/hour12/minute: UI의 네이티브 select 바인딩용
 */
export type BirthValue = {
  birthDate?: string;        // YYYY-MM-DD
  birthTime?: string;        // HH:mm (모름이면 undefined)
  timeUnknown?: boolean;

  year?: string;
  month?: string;
  day?: string;
  ampm?: "AM" | "PM";
  hour12?: string;
  minute?: string;
};

/** 한 자리 숫자를 항상 2자리 문자열로 패딩 ("3" → "03") */
function pad2(s: string) { return s.padStart(2, "0"); }

/** 해당 연·월의 마지막 일(28~31)을 반환 (JS Date 규칙 활용) */
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }

/**
 * WithPlaceholder
 * - 네이티브 <select>에는 placeholder 속성이 없어, 오버레이 텍스트를 얹는 래퍼
 * - globals.css의 .select-wrap / .select-placeholder / .contents 규칙과 함께 사용
 * - empty=true일 때만 placeholder 텍스트를 보이고, 실제 클릭은 select로 전달
 */
function WithPlaceholder({
  empty, text, children,
}: { empty: boolean; text: string; children: ReactNode }) {
  return (
    <div className="select-wrap">
      <span className={`select-placeholder ${empty ? "" : "hidden"}`}>{text}</span>
      <div className="contents">{children}</div>
    </div>
  );
}

/**
 * BirthDateTime
 * - 생년월일(연/월/일) + 출생 시각(오전/오후, 시, 분) 입력 컴포넌트
 * - UX 원칙:
 *   1) 유효 조합일 때만 birthDate(YYYY-MM-DD) 생성
 *   2) '모름' 체크 시 모든 시간 관련 값 제거 + birthTime(undefined 유지)
 *   3) 12시간 표기를 24시간(HH:mm)으로 안전 변환(12AM→00, 12PM→12)
 * - A11y: aria-label, 최소 터치 타깃(44px), iOS 16px 폰트 등 고려
 */
export default function BirthDateTime({
  value, onChange, minYear = 1920, maxYear = new Date().getFullYear(),
}: {
  value: BirthValue;
  onChange: (v: BirthValue) => void;
  minYear?: number;
  maxYear?: number;
}) {
  /** 연도 옵션: 최신 연도부터 역순 (선택 편의성) */
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i)),
    [minYear, maxYear]
  );

  /** 분 옵션: "00" ~ "59" */
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(String(i))), []);

  /**
   * (1) day 보정
   * - 연/월 변경 시 현재 day가 해당 월의 마지막 일을 초과하면 마지막 일로 보정
   * - 예: 2024/02에서 day=31 → 29로 자동 보정
   * - 주의: onChange를 호출하므로 deps 최소화, 무한 루프 방지
   */
  useEffect(() => {
    if (!value.year || !value.month) return;
    const dim = daysInMonth(Number(value.year), Number(value.month));
    if (value.day && Number(value.day) > dim) onChange({ ...value, day: pad2(String(dim)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year, value.month]);

  /**
   * (2) birthDate 조합
   * - day 보정(effect (1))과 경합을 피하기 위해, 우선 보정이 반영된 뒤 다음 렌더에서 갱신
   * - 유효한 4-2-2 자리(YYYY-MM-DD) 조합일 때만 birthDate를 세팅, 아니면 undefined
   * - 동일 값으로의 중복 onChange를 피함(불필요 렌더 방지)
   */
  useEffect(() => {
    const { year, month, day } = value;
    const y4 = !!year && year.length === 4;
    const m2 = !!month && month.length === 2;
    const d2 = !!day && day.length === 2;

    // 최대 일수 초과 상태에서는 (1)의 보정이 먼저 실행되어야 하므로 즉시 반환
    if (y4 && m2 && d2) {
      const dim = daysInMonth(Number(year), Number(month));
      if (Number(day) > dim) {
        return;
      }
    }

    const nextBirthDate = y4 && m2 && d2 ? `${year}-${month}-${day}` : undefined;

    if (value.birthDate !== nextBirthDate) {
      onChange({ ...value, birthDate: nextBirthDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year, value.month, value.day]);

  /**
   * (3) '모름' 체크 핸들링
   * - 사용자가 '모름'을 선택하면 시간 관련 UI 상태를 모두 제거
   * - 서버 스키마와 합치: birthTime 필드는 아예 존재하지 않도록(undefined)
   */
  useEffect(() => {
    if (value.timeUnknown) {
      const next = { ...value };
      delete next.ampm; delete next.hour12; delete next.minute;
      if (next.birthTime !== undefined) delete next.birthTime; // undefined로
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.timeUnknown]);

  /**
   * (4) birthTime 조합 (모름 아닐 때만)
   * - AM/PM + 시(1~12) + 분(00~59) → 24시간 HH:mm으로 변환
   * - 12시 예외 처리: 12AM→00, 12PM→12
   * - 입력 일부가 비면 birthTime 필드를 제거(불완전 값 전송 방지)
   */
  useEffect(() => {
    if (value.timeUnknown) return;
    const { ampm, hour12, minute } = value;
    if (hour12 && minute && ampm) {
      const h12 = Math.min(12, Math.max(1, parseInt(hour12, 10))) % 12;
      const h24 = ampm === "PM" ? h12 + 12 : h12; // 12AM→0, 12PM→12
      onChange({ ...value, birthTime: `${pad2(String(h24))}:${minute}` });
    } else if (value.birthTime !== undefined) {
      const next = { ...value };
      delete next.birthTime;
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.ampm, value.hour12, value.minute, value.timeUnknown]);

  /** 시간 입력 활성화 여부(모름이면 dim 처리) */
  const isDim = !!value.timeUnknown;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      {/* ───────────────── 생년월일 ───────────────── */}
      <div className="space-y-2">
        <label className="text-sm text-neutral-300 font-medium">생년월일</label>

        {/* 데스크톱: 2fr-1fr-1fr, 모바일: globals.css에서 균등 분할로 변경 */}
        <div className="grid grid-cols-[2fr_1fr_1fr] sm:grid-cols-3 gap-2">
          {/* 연도(YYYY) */}
          <WithPlaceholder empty={!value.year} text="YYYY">
            <select
              data-testid="bdt-year" aria-label="연도"
              className="form-select w-full"
              /* 값이 비었을 때 placeholder만 보이도록 글자색 투명 처리 */
              style={{ color: !value.year ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px' }}
              value={value.year ?? ""}
              onChange={(e) => onChange({ ...value, year: e.target.value })}
            >
              <option value="" disabled hidden></option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </WithPlaceholder>

          {/* 월(MM) */}
          <WithPlaceholder empty={!value.month} text="MM">
            <select
              data-testid="bdt-month" aria-label="월"
              className="form-select w-full"
              style={{ color: !value.month ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px' }}
              value={value.month ?? ""}
              onChange={(e) => onChange({ ...value, month: pad2(e.target.value) })}
            >
              <option value="" disabled hidden></option>
              {Array.from({ length: 12 }, (_, i) => pad2(String(i + 1))).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </WithPlaceholder>

          {/* 일(DD) — 선택 가능한 일수는 연/월에 따라 동적으로 생성 */}
          <WithPlaceholder empty={!value.day} text="DD">
            <select
              data-testid="bdt-day" aria-label="일"
              className="form-select w-full"
              style={{ color: !value.day ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px' }}
              value={value.day ?? ""}
              onChange={(e) => onChange({ ...value, day: pad2(e.target.value) })}
            >
              <option value="" disabled hidden></option>
              {(() => {
                const dimDays = value.year && value.month
                  ? daysInMonth(Number(value.year), Number(value.month))
                  : 31;
                return Array.from({ length: dimDays }, (_, i) => pad2(String(i + 1)));
              })().map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </WithPlaceholder>
        </div>
      </div>

      {/* ───────────────── 출생 시각 ───────────────── */}
      <div className="space-y-2">
        <label className="text-sm text-neutral-300 font-medium flex items-center justify-between">
          <span>출생 시각</span>
          {/* '모름' 체크: 시간 관련 입력 비활성화 + 내부 값 제거 */}
          <label className="text-xs flex items-center gap-1 cursor-pointer">
            <input
              data-testid="bdt-unknown"
              type="checkbox"
              className="w-3 h-3"
              checked={!!value.timeUnknown}
              onChange={(e) => onChange({ ...value, timeUnknown: e.target.checked })}
            />
            <span>모름</span>
          </label>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {/* 오전/오후(AM/PM) */}
          <WithPlaceholder empty={!value.ampm} text="오전">
            <select
              data-testid="bdt-ampm" aria-label="오전오후"
              className="form-select w-full"
              disabled={isDim}
              style={{ color: !value.ampm ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px', opacity: isDim ? 0.6 : 1 }}
              value={value.ampm ?? ""}
              onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" })}
            >
              <option value="" disabled hidden></option>
              <option value="AM">오전</option>
              <option value="PM">오후</option>
            </select>
          </WithPlaceholder>

          {/* 시(1~12) */}
          <WithPlaceholder empty={!value.hour12} text="시">
            <select
              data-testid="bdt-hour" aria-label="시"
              className="form-select w-full"
              disabled={isDim}
              style={{ color: !value.hour12 ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px', opacity: isDim ? 0.6 : 1 }}
              value={value.hour12 ?? ""}
              onChange={(e) => onChange({ ...value, hour12: e.target.value })}
            >
              <option value="" disabled hidden></option>
              {Array.from({ length: 12 }, (_, i) => pad2(String(i + 1))).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </WithPlaceholder>

          {/* 분(00~59) */}
          <WithPlaceholder empty={!value.minute} text="분">
            <select
              data-testid="bdt-minute" aria-label="분"
              className="form-select w-full"
              disabled={isDim}
              style={{ color: !value.minute ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px', opacity: isDim ? 0.6 : 1 }}
              value={value.minute ?? ""}
              onChange={(e) => onChange({ ...value, minute: e.target.value })}
            >
              <option value="" disabled hidden></option>
              {minutes.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </WithPlaceholder>
        </div>
      </div>
    </div>
  );
}