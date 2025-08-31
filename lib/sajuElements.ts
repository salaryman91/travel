import type { Element, UserInput } from "./types";

/** 간지/오행 계산 보조 상수 */
const STEMS = ["갑","을","병","정","무","기","경","신","임","계"] as const;
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"] as const;

const STEM_TO_ELEM: Record<number, Element> = {
  0:"wood",1:"wood",2:"fire",3:"fire",4:"earth",5:"earth",6:"metal",7:"metal",8:"water",9:"water"
};
const BRANCH_TO_ELEM: Record<number, Element> = {
  0:"water",1:"earth",2:"wood",3:"wood",4:"earth",5:"fire",6:"fire",7:"earth",8:"metal",9:"metal",10:"earth",11:"water"
};

// 지지의 지장간 블렌드 (합=1) — 시간(시지)에만 적용
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

const NEUTRAL: Record<Element, number> = {
  wood: 0.2, fire: 0.2, earth: 0.2, metal: 0.2, water: 0.2,
};

/** 년주(간지) — 간단화: 서력 기준 모듈러 */
function ganzhiYear(d: Date) {
  const y = d.getFullYear();
  const stem = (y - 4) % 10;
  const branch = (y - 4) % 12;
  return { stem, branch, label: { stem: STEMS[stem], branch: BRANCHES[branch] } };
}

/** 월주(간지) — 간단화: (연간 영향 무시, 월 기반 모듈러) */
function ganzhiMonth(d: Date, _yearStem: number) {
  const m = d.getMonth(); // 0~11
  const stem = (m + 2) % 10;
  const branch = (m + 1) % 12;
  return { stem, branch, label: { stem: STEMS[stem], branch: BRANCHES[branch] } };
}

/** 시지 인덱스 (0=자 … 11=해) */
function hourBranchIndex(hour: number) {
  // 子:23~01, 丑:01~03 … 辰:07~09 … 戌:19~21 … 亥:21~23
  const table = [23,1,3,5,7,9,11,13,15,17,19,21];
  for (let i=0;i<12;i++) {
    const start = table[i];
    const end = (table[(i+1)%12] + 24) % 24;
    if (start < end) {
      if (hour >= start && hour < end) return i;
    } else {
      if (hour >= start || hour < end) return i;
    }
  }
  return 0;
}

function parseLocalDateTime(input: UserInput) {
  const [y, m, d] = (input.birthDate ?? "2000-01-01").split("-").map(Number);
  const [hh, mm] = (input.birthTime ?? "00:00").split(":").map(Number);
  // Asia/Seoul 기준으로 해석(테스트에서 TZ 고정)
  return new Date(y, (m ?? 1)-1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function getElements(input: UserInput) {
  const { elements } = getElementsWithDetail(input);
  return elements;
}

export function getElementsWithDetail(input: UserInput) {
  // 사주 미입력: 완전 중립
  if (!input.birthDate) {
    return {
      elements: { ...NEUTRAL },
      pillars: { yearStem: "-", yearBranch: "-", monthStem: "-", monthBranch: "-", hourBranch: "-" },
    };
  }

  const dt = parseLocalDateTime(input);
  const y = ganzhiYear(dt);
  const m = ganzhiMonth(dt, y.stem);

  const hasTime = !!input.birthTime && /^\d{2}:\d{2}$/.test(input.birthTime);
  const hb = hasTime ? hourBranchIndex(dt.getHours()) : null;

  // 가중: 연간1·연지1·월간2·월지2·시지1.5(시간 있을 때만)
  const acc: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const w = { yearStem: 1, yearBranch: 1, monthStem: 2, monthBranch: 2, hourBranch: 1.5 };
  acc[STEM_TO_ELEM[y.stem]]     += w.yearStem;
  acc[BRANCH_TO_ELEM[y.branch]] += w.yearBranch;
  acc[STEM_TO_ELEM[m.stem]]     += w.monthStem;
  acc[BRANCH_TO_ELEM[m.branch]] += w.monthBranch;
  if (hb !== null) {
    for (const [el, ratio] of BRANCH_HIDDEN_BLEND[hb]) acc[el] += w.hourBranch * ratio;
  }

  const sum = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
  (Object.keys(acc) as Element[]).forEach((k) => (acc[k] = acc[k] / sum));

  return {
    elements: acc,
    pillars: {
      yearStem: y.label.stem, yearBranch: y.label.branch,
      monthStem: m.label.stem, monthBranch: m.label.branch,
      hourBranch: hb === null ? "-" : BRANCHES[hb],
    },
  };
}