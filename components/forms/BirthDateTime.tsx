"use client";

import { useEffect, useMemo, type ReactNode } from "react";

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

function pad2(s: string) { return s.padStart(2, "0"); }
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }

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

export default function BirthDateTime({
  value, onChange, minYear = 1920, maxYear = new Date().getFullYear(),
}: {
  value: BirthValue;
  onChange: (v: BirthValue) => void;
  minYear?: number;
  maxYear?: number;
}) {
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i)),
    [minYear, maxYear]
  );
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(String(i))), []);

  // day 보정
  useEffect(() => {
    if (!value.year || !value.month) return;
    const dim = daysInMonth(Number(value.year), Number(value.month));
    if (value.day && Number(value.day) > dim) onChange({ ...value, day: pad2(String(dim)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year, value.month]);

  // birthDate 조합
  useEffect(() => {
    const { year, month, day } = value;
    const y4 = !!year && year.length === 4;
    const m2 = !!month && month.length === 2;
    const d2 = !!day && day.length === 2;
    onChange({ ...value, birthDate: y4 && m2 && d2 ? `${year}-${month}-${day}` : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year, value.month, value.day]);

  // 모름이면 시간 관련 값을 모두 비우고 birthTime을 undefined로 유지
  useEffect(() => {
    if (value.timeUnknown) {
      const next = { ...value };
      delete next.ampm; delete next.hour12; delete next.minute;
      if (next.birthTime !== undefined) delete next.birthTime; // undefined로
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.timeUnknown]);

  // birthTime 조합 (모름 아닐 때만)
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

  const isDim = !!value.timeUnknown;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      {/* 생년월일 */}
      <div className="space-y-2">
        <label className="text-sm text-neutral-300 font-medium">생년월일</label>
        <div className="grid grid-cols-[2fr_1fr_1fr] sm:grid-cols-3 gap-2">
          {/* 연도 */}
          <WithPlaceholder empty={!value.year} text="YYYY">
            <select
              data-testid="bdt-year" aria-label="연도"
              className="form-select w-full"
              style={{ color: !value.year ? 'transparent' : '#ffffff', fontSize: '16px', minHeight: '44px' }}
              value={value.year ?? ""}
              onChange={(e) => onChange({ ...value, year: e.target.value })}
            >
              <option value="" disabled hidden></option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </WithPlaceholder>

          {/* 월 */}
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

          {/* 일 */}
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

      {/* 출생 시각 */}
      <div className="space-y-2">
        <label className="text-sm text-neutral-300 font-medium flex items-center justify-between">
          <span>출생 시각</span>
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
          {/* AM/PM */}
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

          {/* 시 */}
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

          {/* 분 */}
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