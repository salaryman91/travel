# MBTI × 사주 결합 여행지 추천

MBTI 성향과 사주(오행) 신호를 결합해 **설명 가능한 규칙 기반**으로 여행지를 추천하는 Next.js 애플리케이션입니다. 개인정보를 저장하지 않으며, Edge 런타임에서 빠르게 응답합니다.

---

## 핵심 특징

* **설명 가능한 추천**: MBTI 6개 성향 축과 사주 오행 분포를 코사인 유사도로 점수화하고, 시즌/예산/동반 형태 보정 규칙을 적용합니다.
* **개인정보 미저장**: 생년월일/시각은 요청 단위로만 사용되며 서버에 저장하지 않습니다.
* **Edge 런타임**: `export const runtime = "edge"` 구성으로 빠른 응답.
* **동적 OG 이미지**: `/opengraph-image` 라우트에서 `ImageResponse`로 1200×630 이미지를 생성.
* **접근성/모바일 최적화**: iOS 16px 줌 방지, 터치 타깃 44px, 네이티브 셀렉트 커스터마이징.
* **테스트 커버리지**: Vitest + Testing Library로 컴포넌트/스코어링/데이터 무결성/API 계약 테스트 포함.

---

## 기술 스택

* **Framework**: Next.js (App Router)
* **Runtime**: Edge (Vercel 권장)
* **Language**: TypeScript (strict)
* **Styling**: Tailwind CSS (v4 인라인 테마 사용 가능)
* **Validation**: Zod
* **Testing**: Vitest, @testing-library/react, jest-dom 매처(vitest용 번들)

---

## 프로젝트 구조

```
├─ app/
│  ├─ layout.tsx                # 메타데이터/폰트/전역 바디
│  ├─ globals.css               # 테마 변수, 네이티브 select 개선
│  ├─ page.tsx                  # 클라이언트 폼, 추천 결과 렌더
│  ├─ opengraph-image.tsx       # 동적 OG 이미지(Edge)
│  ├─ robots.ts / sitemap.ts    # SEO 라우트
│  └─ api/recommend/route.ts    # 추천 API(Edge + zod 검증)
├─ components/forms/
│  └─ BirthDateTime.tsx         # 출생일/시각 입력(YY/MM/DD + AM/PM)
├─ data/
│  └─ destinations.ts           # 목적지 데이터셋(특성/오행/시즌/예산 등)
├─ lib/
│  ├─ types.ts                  # 공용 타입(MBTI, Trait, Element 등)
│  ├─ mbtiToTraits.ts           # MBTI→성향 벡터 변환
│  ├─ sajuElements.ts           # 오행 분포 계산(간지 단순 모델)
│  └─ scoring.ts                # 점수/패널티/시즌/프리젠테이션 로직
├─ public/favicon.ico           # 파비콘
├─ tsconfig.json                # 경로 별칭(@/*) 등
├─ vitest.config.ts             # Vitest 설정
└─ tests/setup.ts               # RTL DOM 매처 등록
```

---

## 빠른 시작

### 1) 요구 사항

* Node.js 18 이상 권장
* 패키지 매니저: npm, pnpm, yarn 중 택1

### 2) 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
npm run start

# 테스트 실행
npm run test
```

> 참고: 실제 스크립트는 `package.json`을 기준으로 하며, 프로젝트 설정에 따라 달라질 수 있습니다.

### 3) 환경 변수

* `NEXT_PUBLIC_SITE_URL` (권장): 배포 시 풀 도메인. 예) `https://example.com`

  * `app/layout.tsx`의 `metadataBase` 및 OG/Twitter 카드 생성에 사용됩니다.

---

## API

### Endpoint

`POST /api/recommend`

### 요청 본문 스키마 (Zod 기반)

* `mbti` (선택): 16가지 코드 중 하나. 미지정 시 서버 기본값 `INTP` 사용
* `travelMonth` (선택): 1–12
* `budgetLevel` (선택): 1–5
* `companions` (선택): `solo | couple | friends | family` (기본 `solo`)
* `region` (선택): `all | domestic | overseas` (기본 `all`)
* `birthDate` (선택): `YYYY-MM-DD` 또는 빈 문자열
* `birthTime` (선택): `HH:mm` 또는 빈 문자열. 빈 문자열은 `undefined`로 처리

검증 규칙 요약:

* `birthDate`는 `YYYY-MM-DD` 형식만 허용
* `birthTime`은 `""` 또는 `HH:mm`만 유효. `null`은 400 오류
* 잘못된 JSON 본문은 400 오류

### 예시 요청

```bash
curl -X POST https://your.domain/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{
    "mbti": "INTP",
    "travelMonth": 10,
    "budgetLevel": 2,
    "companions": "solo",
    "region": "all",
    "birthDate": "1991-01-18",
    "birthTime": "09:30"
  }'
```

### 예시 응답

```json
{
  "results": [
    {
      "destination": {
        "id": "jeju",
        "name": "제주도",
        "country": "대한민국",
        "region": "domestic",
        "traitProfile": { "social": 0.5, ... },
        "elementProfile": { "water": 0.45, ... },
        "bestMonths": [4,5,6,9,10],
        "budgetLevel": 3
      },
      "score": 0.7421,
      "tier": "A",
      "share": 0.21,
      "percentile": 5,
      "explain": {
        "mbtiTop": [["structure", 0.8], ["flexibility", 0.7]],
        "sajuTop": [["water", 0.34], ["wood", 0.27]],
        "notes": ["MBTI 성향(질서/안정, 유연성/자유): ...", "사주 오행(수, 목): ..."]
      }
    }
  ],
  "ctx": {
    "traits": { "social": 0.35, ... },
    "elements": { "wood": 0.2, ... },
    "pillars": { "yearStem": "경", "yearBranch": "자", ... }
  }
}
```

응답 헤더: `Cache-Control: s-maxage=60`

---

## 개인화 및 스코어링 로직

주요 단계는 다음과 같습니다.

1. **MBTI → 성향 벡터** (`mbtiToTraits`)

   * 6개 축: social, novelty, structure, flexibility, sensory, culture
   * 살리언스/봉우리 보정으로 특성이 평평해지는 것을 완화합니다.

2. **동반 형태 블렌딩**

   * `solo/couple/friends/family` 바이어스를 MBTI 성향에 가중 평균으로 합성(CTB=0.18).

3. **사주 오행 분포** (`sajuElements`)

   * 연/월 간지, 시지(선택)에서 오행 비중을 누적 후 정규화(합=1).
   * 시각 미입력 시 시간 가중 제외로 자동 감쇠.

4. **코어 점수**

   * `W.alpha * cos(MBTI, 목적지_trait) + betaLocal * cos(오행, 목적지_element)`
   * 예산/안전/거리(옵션) 페널티 감산, 시즌 보너스/페널티 적용.

5. **다양성/지배도 제어**

   * 해시 기반 경미한 지터, 국가 과점 방지 보정.

6. **프레젠테이션 메타**

   * 소프트맥스 지분(`share`), 상대 근접도 기반 등급(`tier`), 순위 퍼센타일.

가중치 주요값(요약):

* `alpha=0.50`, `beta=0.40`(시각 없으면 0.7배), `gamma=0.35`, `season=1.0`
* 소프트맥스 온도 `T=0.08`

주의: 사주 모델은 단순화된 규칙이며, 엔터테인먼트/퍼스널라이제이션 목적으로만 사용됩니다.

---

## 데이터 모델

### `Destination`

* 필수: `id`, `name`, `country`, `region`, `traitProfile`, `elementProfile`, `budgetLevel`
* 선택: `bestMonths`, `themes`, `suitableFor`, `kidFriendly`, `accessEase`, `safetyIndex`, `languageEase`, `nightlife`, `groupEase`, `avgFlightHoursFromICN`, `notes` 등
* 모든 프로파일 값은 0\~1 정규화 가정

데이터 무결성 테스트는 다음을 검증합니다.

* 예산 1–5, 월 1–12 범위, 프로파일 값 0–1
* 선택 필드 타입 일치성

---

## 프런트엔드 UX

* `BirthDateTime` 컴포넌트로 생년월일/시각 입력

  * 연/월 변경 시 일 자동 클램프(윤년/비윤년 처리)
  * AM/PM + 12시간 입력을 24시간 `HH:mm`으로 합성
  * "모름" 체크 시 시간 필드 비활성 및 `birthTime` 제거
* 네이티브 `select`를 기반으로 접근성 유지

  * iOS 폰트 16px 강제, 44px 터치 타깃, 커스텀 화살표

---

## 테스트

* 러너: Vitest
* 환경: jsdom (+ `tests/setup.ts`에서 jest-dom 매처 전역 등록)
* 실행 예시:

```bash
npm run test
```

테스트 스위트 개요

* `BirthDateTime`: 조합 로직·클램프·모름 처리
* `sajuElements`: 합=1, 시간 유무 분기, TZ=Asia/Seoul 고정
* `destinations`: 데이터 무결성
* `api/recommend`: 스키마/계약 검증(200/400, coerce, 포맷)
* `scoring`: 예산 strict+fallback, 시즌 완충, 다양성, 지배도 캡, 고가 필터

---

## 배포

* Vercel 배포 권장.
* 환경 변수 `NEXT_PUBLIC_SITE_URL` 설정.
* Edge 런타임 라우트는 지역 배치 영향이 있으므로 실제 트래픽 지역에 맞춰 리전 설정을 검토하십시오.

---

## 보안/개인정보

* 입력 정보는 요청 처리에만 사용되며 저장하지 않습니다.
* 로깅/분석 도구 추가 시 개인정보가 포함되지 않도록 마스킹을 권장합니다.

---

## 한계와 주의 사항

* 사주 계산은 간단화된 간지/오행 규칙을 사용합니다. 실제 명리 해석과 차이가 있습니다.
* 목적지 데이터셋의 최신성/정확도에 따라 추천 결과가 달라질 수 있습니다.
* 날씨/환율/항공 스케줄 등 외생 변수는 현재 스코어링에 포함되지 않습니다.

---