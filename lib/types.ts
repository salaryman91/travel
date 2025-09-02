/**
 * types.ts
 * - 전역 타입 정의 모듈
 * - 런타임 로직이 의존하는 공통 타입(입력/목적지/개인화 컨텍스트 등)을 한곳에서 관리합니다.
 * - 모든 수치 지표는 별도 표기가 없으면 0~1 정규화(real number) 가정입니다.
 */

export type MBTI =
  // 16가지 MBTI 코드(대문자 4글자 고정)
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISTP" | "ESTJ" | "ESTP"
  | "ISFJ" | "ISFP" | "ESFJ" | "ESFP";

/** 오행(목·화·토·금·수) 코드 */
export type Element = "wood" | "fire" | "earth" | "metal" | "water";

/** 추천 엔진에서 사용하는 6개 성향 축 */
export type Trait =
  | "social"      // 사회성/교류
  | "novelty"     // 새로움/탐색
  | "structure"   // 질서/안정
  | "flexibility" // 유연성/자유
  | "sensory"     // 감각/자극
  | "culture";    // 문화/역사

/** 지역 구분(데이터상 실제 목적지의 속성) */
export type Region = "domestic" | "overseas";

/** 검색/필터용 지역 선택자 */
export type RegionFilter = "all" | Region;

/** 동반 형태 */
export type Companion = "solo" | "couple" | "friends" | "family";

/** 목적지 테마 태그 */
export type Theme =
  | "city" | "nature" | "beach" | "mountain" | "museum"
  | "food" | "nightlife" | "onsen" | "history" | "art";

/** 예산 레벨(3박4일·항공 제외 기준, 1=초저 … 5=최고) */
export type BudgetLevel = 1 | 2 | 3 | 4 | 5;

/**
 * 사용자 입력(클라이언트 → API)
 * - 모든 필드는 설명가능성을 위해 규칙 기반 추천 로직에 직접 사용됩니다.
 * - 개인정보 저장 없음(일회성 처리).
 */
export interface UserInput {
  /** 16가지 MBTI 코드 */
  mbti: MBTI;

  /** 여행 예정 월(1~12, 선택) */
  travelMonth?: number;            // 1~12

  /** 예산 레벨(1=초저 … 5=최고, 선택) */
  budgetLevel?: BudgetLevel;       // 1=초저 … 5=최고

  /** 동반 형태(선택) */
  companions?: Companion;          // 'solo' | 'couple' | 'friends' | 'family'

  /** 지역 필터(선택) — 'all'은 전체 검색 */
  region?: RegionFilter;           // 'all' | 'domestic' | 'overseas'

  // ── 사주 관련(선택) — 서버 저장 없음 ─────────────────────────
  /** 출생일(YYYY-MM-DD, 선택) */
  birthDate?: string;              // 'YYYY-MM-DD'

  /** 출생시각(HH:mm, 24h, 선택) — 모름이면 undefined/빈 문자열 */
  birthTime?: string;              // 'HH:mm'

  /** 출생지(현 단계 미사용, 선택) */
  birthPlace?: string;             // (현 단계 미사용)

  /**
   * 최대 허용 비행시간(시간, 선택)
   * - 없으면 로직에서 4로 가정할 수 있음(알고리즘/옵션에 따라 사용).
   */
  maxFlightHours?: number;
}

/**
 * 목적지(데이터셋의 한 항목)
 * - traitProfile/elementProfile은 0~1 정규화 벡터(부분 키만 채워져도 됨).
 * - 보조 지표(accessEase 등)는 없을 수 있으며, 있을수록 동반형태 점수 신뢰도가 올라갑니다.
 */
export interface Destination {
  /** 내부 식별자(고유) */
  id: string;

  /** 표시명(예: '제주도') */
  name: string;

  /** 국가명(예: '대한민국') */
  country: string;

  /** 지역 구분 */
  region: Region;

  /** 선택: 도시명(예: '서울') */
  city?: string;

  /** 성향 프로파일(0~1, 일부 키만 존재 가능) */
  traitProfile: Partial<Record<Trait, number>>;

  /** 오행 프로파일(0~1, 일부 키만 존재 가능) */
  elementProfile: Partial<Record<Element, number>>;

  /** 권장 방문 월 목록(1~12, 선택) */
  bestMonths?: number[];

  /** 선택: 장마/우기 월 */
  rainySeasonMonths?: number[];

  /** 선택: 폭염 경고 월 */
  heatAlertMonths?: number[];

  /** 예산 레벨(1=초저 … 5=최고) */
  budgetLevel: BudgetLevel;

  /** 비용 인덱스(저렴=1, 고가=0, 선택) */
  costIndex?: number;              // 0~1 (저렴=1, 고가=0)

  /** 접근성(공항/대중교통, 선택) */
  accessEase?: number;             // 0~1

  /** 체감 안전도(선택) */
  safetyIndex?: number;            // 0~1

  /** 언어/표지판 적응 난이도(쉬움=1, 선택) */
  languageEase?: number;           // 0~1

  /** 야간 액티비티 풍부도(선택) */
  nightlife?: number;              // 0~1

  /** 3~4인 동선/숙박 용이성(선택) */
  groupEase?: number;              // 0~1

  /** 가족여행 친화 여부(선택) */
  kidFriendly?: boolean;

  /** 동반 형태 적합성 리스트(선택) */
  suitableFor?: Companion[];

  /** 테마 태그(선택) */
  themes?: Theme[];

  /** 인천(ICN) 기준 평균 비행시간(시간, 선택) */
  avgFlightHoursFromICN?: number;

  /** 강력 추천 체험/코스(선택) */
  mustTry?: string[];

  /** 기타 노트(프레젠테이션용, 선택) */
  notes?: string[];
}

/**
 * 개인화 컨텍스트(설명/디버깅 노출용)
 * - traits  : MBTI → 6축 성향 벡터
 * - elements: 사주 오행 분포(합=1)
 * - pillars : 연/월/시 간지 라벨(시주는 지지만 사용)
 */
export interface PersonalizationContext {
  traits: Record<Trait, number>;
  elements: Record<Element, number>;
  pillars: {
    yearStem: string;   yearBranch: string;
    monthStem: string;  monthBranch: string;
    hourBranch: string; // (시주는 지지만 사용)
  };
  /** 선택: 입력 동반 형태 (설명/로깅용) */
  companion?: Companion;
}