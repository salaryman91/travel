export type MBTI =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISTP" | "ESTJ" | "ESTP"
  | "ISFJ" | "ISFP" | "ESFJ" | "ESFP";

export type Element = "wood" | "fire" | "earth" | "metal" | "water";
export type Trait   = "social" | "novelty" | "structure" | "flexibility" | "sensory" | "culture";

export type Region       = "domestic" | "overseas";
export type RegionFilter = "all" | Region;
export type Companion    = "solo" | "couple" | "friends" | "family";
export type Theme =
  | "city" | "nature" | "beach" | "mountain" | "museum"
  | "food" | "nightlife" | "onsen" | "history" | "art";

export type BudgetLevel = 1 | 2 | 3 | 4 | 5;

export interface UserInput {
  mbti: MBTI;
  travelMonth?: number;            // 1~12
  budgetLevel?: BudgetLevel;       // 1=초저 … 5=최고
  companions?: Companion;          // 'solo' | 'couple' | 'friends' | 'family'
  region?: RegionFilter;           // 'all' | 'domestic' | 'overseas'
  // 사주(선택) — 서버 저장 없음
  birthDate?: string;              // 'YYYY-MM-DD'
  birthTime?: string;              // 'HH:mm'
  birthPlace?: string;             // (현 단계 미사용)
  /** 선택: 최대 허용 비행시간(시간). 없으면 4로 가정 */
  maxFlightHours?: number;
}

 export interface Destination {
   id: string;
   name: string;
   country: string;
   region: Region;
  /** 선택: 도시명 */
  city?: string;
   traitProfile: Partial<Record<Trait, number>>;
   elementProfile: Partial<Record<Element, number>>;
   bestMonths?: number[];
  /** 선택: 장마/우기 월 */
  rainySeasonMonths?: number[];
  /** 선택: 폭염 경고 월 */
  heatAlertMonths?: number[];
   budgetLevel: BudgetLevel;
  /** 0~1 (저렴=1, 고가=0) */
  costIndex?: number;
  /** 0~1 (공항/대중교통 접근성) */
  accessEase?: number;
  /** 0~1 (체감 안전도) */
  safetyIndex?: number;
  /** 0~1 (언어/표지판 적응 난이도; 쉬움=1) */
  languageEase?: number;
  /** 0~1 (야간 액티비티 풍부도) */
  nightlife?: number;
  /** 0~1 (3~4인 동선/숙박 용이성) */
  groupEase?: number;
  /** 가족여행 적합성 */
  kidFriendly?: boolean;
  /** 동반 형태 선호 리스트 */
  suitableFor?: Companion[];
  /** 테마 태그 */
  themes?: Theme[];
  /** 인천 기준 평균 비행시간(시간) */
  avgFlightHoursFromICN?: number;
  /** 강추 체험/코스 */
  mustTry?: string[];
   notes?: string[];
 }

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