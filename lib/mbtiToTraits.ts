import type { MBTI, Trait } from "./types";

/**
 * mbtiToTraits
 * - 목적: 16가지 MBTI 문자열(예: "INTP")을 6가지 성향 점수(0~1)로 매핑
 * - 출력: Record<Trait, number>
 *   • social     : 사회성/교류 성향(대인 상호작용 선호)
 *   • novelty    : 새로움/탐색 성향(새로운 자극·발견 추구)
 *   • structure  : 질서/계획 성향(규칙·계획 선호)
 *   • flexibility: 유연성/즉흥 성향(상황 적응·자유 선호)
 *   • sensory    : 감각/자극 성향(오감 기반 체험 선호)
 *   • culture    : 문화/역사 성향(예술·스토리·의미 탐색)
 *
 * 방법(휴리스틱 가중치):
 * 1) 모든 지표를 0.5에서 시작(중립 기준)
 * 2) 각 글자(E/I, N/S, F/T, J/P)에 따라 다음 가중치를 더/빼서 조정
 *    - E(외향): social +0.25 / I(내향): social -0.15
 *    - N(직관): novelty +0.25, culture +0.10
 *      S(감각): sensory +0.20, structure +0.05
 *    - F(감정): culture +0.20, social +0.05
 *      T(사고): structure +0.10
 *    - J(판단): structure +0.25, flexibility -0.10
 *      P(인식): flexibility +0.25
 * 3) 최종적으로 각 지표를 0~1 범위로 클램프(안전 범위 보장)
 *
 * 주의:
 * - 이 매핑은 설명 가능한 규칙 기반 추천을 위한 휴리스틱으로, 심리측정학적 타당성 검증을 대체하지 않습니다.
 */
export function mbtiToTraits(mbti: MBTI): Record<Trait, number> {
  // MBTI는 4자(예: I N T P). 앞에서부터 a,b,c,d로 분리
  const [a, b, c, d] = mbti.split("") as [string, string, string, string];

  // 1) 중립 베이스라인(각 지표 0.5)
  const t: Record<Trait, number> = {
    social: 0.5,
    novelty: 0.5,
    structure: 0.5,
    flexibility: 0.5,
    sensory: 0.5,
    culture: 0.5,
  };

  // 2) 글자별 가중치 적용
  // E / I → 사회성 조정(외향 +, 내향 -)
  if (a === "E") t.social += 0.25;
  else t.social -= 0.15;

  // N / S → 새로움·문화 vs 감각·질서
  if (b === "N") {
    t.novelty += 0.25;
    t.culture += 0.1;
  } else {
    t.sensory += 0.2;
    t.structure += 0.05;
  }

  // F / T → 문화·사회성 vs 질서(사고)
  if (c === "F") {
    t.culture += 0.2;
    t.social += 0.05;
  } else {
    t.structure += 0.1;
  }

  // J / P → 질서 vs 유연성
  if (d === "J") {
    t.structure += 0.25;
    t.flexibility -= 0.1;
  } else {
    t.flexibility += 0.25;
  }

  // 3) 안전 범위 보정: 0 ≤ score ≤ 1
  (Object.keys(t) as Trait[]).forEach(
    (k) => (t[k] = Math.max(0, Math.min(1, t[k])))
  );

  return t;
}