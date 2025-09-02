import type { Element, UserInput } from "./types";

/**
 * elements.ts (간지/오행 유틸)
 * - 목적: 생년월일(+선택: 출생시각)을 간지(천간/지지)로 단순 산출 → 오행 비중(목·화·토·금·수) 확률 분포로 정규화
 * - 설계:
 *   1) 간단화된 간지 매핑(연도·월 기반 모듈러) — 전통식보다 간략, 설명가능/일관성 우선
 *   2) 시지(시간) 입력 시, 지장간 블렌드(합=1)를 적용해 오행 가중을 미세 조정
 *   3) 결과는 합=1로 정규화된 Record<Element, number>를 반환
 * - 주의:
 *   • 본 로직은 점성/명리의 정밀 계산을 대체하지 않는 휴리스틱입니다.
 *   • Asia/Seoul 로컬 시간대로 해석(프로덕션/테스트 환경 일관성 가정; 한국은 DST 미적용)
 */

/** 간지 표기용 상수(인덱스 0부터) */
const STEMS = ["갑","을","병","정","무","기","경","신","임","계"] as const;
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"] as const;

/** 천간 인덱스(0~9) → 오행 매핑 */
const STEM_TO_ELEM: Record<number, Element> = {
  0:"wood", 1:"wood", 2:"fire", 3:"fire", 4:"earth",
  5:"earth", 6:"metal", 7:"metal", 8:"water", 9:"water"
};

/** 지지 인덱스(0~11) → 오행 매핑 */
const BRANCH_TO_ELEM: Record<number, Element> = {
  0:"water", 1:"earth", 2:"wood", 3:"wood", 4:"earth", 5:"fire",
  6:"fire", 7:"earth", 8:"metal", 9:"metal", 10:"earth", 11:"water"
};

/**
 * 지지의 지장간(숨은 천간) 블렌드 — 시지(시간)에만 적용
 * - 각 지지(0=자…11=해)에 대해 오행 비율의 합이 1이 되도록 정의
 * - 예: '축'(1)은 토 중심이나 금/수 성분 일부 반영
 */
const BRANCH_HIDDEN_BLEND: Record<number, Array<[Element, number]>> = {
  0: [["water", 1.0]],
  1: [["earth", 0.6], ["water", 0.2], ["metal", 0.2]],
  2: [["wood", 0.6], ["fire", 0.3], ["earth", 0.1]],
  3: [["wood", 1.0]],
  4: [["earth", 0.6], ["wood", 0.2], ["water", 0.2]],
  5: [["fire", 0.6], ["metal", 0.25], ["earth", 0.15]],
  6: [["fire", 0.7], ["earth", 0.3]],
  7: [["earth", 0.6], ["wood", 0.25], ["fire", 0.15]],
  8: [["metal", 0.6], ["water", 0.25], ["earth", 0.15]],
  9: [["metal", 1.0]],
 10: [["earth", 0.6], ["fire", 0.25], ["metal", 0.15]],
 11: [["water", 0.6], ["wood", 0.4]],
};

/** 사주 미입력 시 사용할 완전 중립 분포(합=1) */
const NEUTRAL: Record<Element, number> = {
  wood: 0.2, fire: 0.2, earth: 0.2, metal: 0.2, water: 0.2,
};

/**
 * 년주(간지) — 서력 기준 단순 모듈러
 * - 기준: (year - 4) % 10 → 천간, (year - 4) % 12 → 지지
 * - 1984년이 갑자(甲子)에 매핑되도록 맞춘 단순화된 공식
 */
function ganzhiYear(d: Date) {
  const y = d.getFullYear();
  const stem = (y - 4) % 10;   // 0~9
  const branch = (y - 4) % 12; // 0~11
  return { stem, branch, label: { stem: STEMS[stem], branch: BRANCHES[branch] } };
}

/**
 * 월주(간지) — 단순화 버전
 * - 전통식에서는 '월간'이 '연간'에 의해 결정되지만, 여기서는 설명가능·일관성을 위해 월 기반 모듈러만 사용
 * - stem: (monthIndex + 2) % 10, branch: (monthIndex + 1) % 12
 *   (monthIndex는 0=1월 … 11=12월)
 */
function ganzhiMonth(d: Date, _yearStem: number) {
  const m = d.getMonth(); // 0~11
  const stem = (m + 2) % 10;
  const branch = (m + 1) % 12;
  return { stem, branch, label: { stem: STEMS[stem], branch: BRANCHES[branch] } };
}

/**
 * 시지 인덱스 계산 (0=자 … 11=해)
 * - 2시간 단위의 지지 구간을 반열림 [start, end)로 처리, 자시(23~01)처럼 자정 경계는 래핑 처리
 * - table[i]는 각 지지의 시작 시각(시, 0~23)
 */
function hourBranchIndex(hour: number) {
  // 子:23~01, 丑:01~03 … 辰:07~09 … 戌:19~21 … 亥:21~23
  const table = [23,1,3,5,7,9,11,13,15,17,19,21];
  for (let i=0;i<12;i++) {
    const start = table[i];
    const end = (table[(i+1)%12] + 24) % 24;
    if (start < end) {
      if (hour >= start && hour < end) return i;
    } else {
      // 자정 래핑 구간: [start, 24) ∪ [0, end)
      if (hour >= start || hour < end) return i;
    }
  }
  return 0; // 이론상 도달하지 않음(보호용)
}

/**
 * 로컬(Asia/Seoul) Date 생성
 * - 입력 문자열을 로컬 타임존으로 해석하여 JS Date 생성
 * - birthDate가 없으면 '2000-01-01', birthTime이 없으면 '00:00'을 사용
 */
function parseLocalDateTime(input: UserInput) {
  const [y, m, d] = (input.birthDate ?? "2000-01-01").split("-").map(Number);
  const [hh, mm] = (input.birthTime ?? "00:00").split(":").map(Number);
  // Asia/Seoul 기준으로 해석(테스트에서 TZ 고정)
  return new Date(y, (m ?? 1)-1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * getElements
 * - elements만 필요할 때 간단히 호출하는 래퍼
 */
export function getElements(input: UserInput) {
  const { elements } = getElementsWithDetail(input);
  return elements;
}

/**
 * getElementsWithDetail
 * - 입력값을 바탕으로 오행 분포와 간지 라벨(year/month/hour)을 함께 반환
 * - 가중치(설명가능 규칙):
 *   yearStem:1, yearBranch:1, monthStem:2, monthBranch:2, hourBranch:1.5(시간 입력 시)
 * - normalization: 합이 0이더라도 1로 나눠 0 division 방지(실제로는 acc 합이 >0)
 */
export function getElementsWithDetail(input: UserInput) {
  // 사주 미입력: 완전 중립
  if (!input.birthDate) {
    return {
      elements: { ...NEUTRAL },
      pillars: { yearStem: "-", yearBranch: "-", monthStem: "-", monthBranch: "-", hourBranch: "-" },
    };
  }

  // 1) 입력 파싱 → 로컬 Date
  const dt = parseLocalDateTime(input);

  // 2) 년/월 간지(단순 모듈러)
  const y = ganzhiYear(dt);
  const m = ganzhiMonth(dt, y.stem);

  // 3) 시지(선택): HH:mm 패턴일 때만 계산
  const hasTime = !!input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime);
  const hb = hasTime ? hourBranchIndex(dt.getHours()) : null;

  // 4) 가중 집계
  //    - 연간1·연지1·월간2·월지2·시지1.5(지장간 블렌드)
  const acc: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const w = { yearStem: 1, yearBranch: 1, monthStem: 2, monthBranch: 2, hourBranch: 1.5 };

  acc[STEM_TO_ELEM[y.stem]]     += w.yearStem;
  acc[BRANCH_TO_ELEM[y.branch]] += w.yearBranch;
  acc[STEM_TO_ELEM[m.stem]]     += w.monthStem;
  acc[BRANCH_TO_ELEM[m.branch]] += w.monthBranch;

  if (hb !== null) {
    // 시지의 지장간 비율만큼 시간 가중치를 분배
    for (const [el, ratio] of BRANCH_HIDDEN_BLEND[hb]) acc[el] += w.hourBranch * ratio;
  }

  // 5) 정규화(합=1)
  const sum = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
  (Object.keys(acc) as Element[]).forEach((k) => (acc[k] = acc[k] / sum));

  // 6) 라벨(한자 표기) 포함해 반환
  return {
    elements: acc,
    pillars: {
      yearStem: y.label.stem, yearBranch: y.label.branch,
      monthStem: m.label.stem, monthBranch: m.label.branch,
      hourBranch: hb === null ? "-" : BRANCHES[hb],
    },
  };
}