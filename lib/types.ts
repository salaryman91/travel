export type MBTI =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISTP" | "ESTJ" | "ESTP"
  | "ISFJ" | "ISFP" | "ESFJ" | "ESFP";

export type Element = "wood" | "fire" | "earth" | "metal" | "water";
export type Trait   = "social" | "novelty" | "structure" | "flexibility" | "sensory" | "culture";

export type Region       = "domestic" | "overseas";
export type RegionFilter = "all" | Region;

export type BudgetLevel = 1 | 2 | 3 | 4 | 5;

export interface UserInput {
  mbti: MBTI;
  travelMonth?: number;            // 1~12
  budgetLevel?: BudgetLevel;       // 1=초저 … 5=최고
  companions?: "solo" | "friends" | "family";
  region?: RegionFilter;           // 'all' | 'domestic' | 'overseas'
  // 사주(선택) — 서버 저장 없음
  birthDate?: string;              // 'YYYY-MM-DD'
  birthTime?: string;              // 'HH:mm'
  birthPlace?: string;             // (현 단계 미사용)
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: Region;
  traitProfile: Partial<Record<Trait, number>>;
  elementProfile: Partial<Record<Element, number>>;
  bestMonths?: number[];
  budgetLevel: BudgetLevel;
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
}