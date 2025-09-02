/**
 * app/opengraph-image.tsx
 * - 목적: SNS 공유용 Open Graph 이미지(1200×630) 동적 생성
 * - 런타임: Edge (빠른 콜드 스타트, Node 전용 API 사용 금지)
 * - 주의:
 *   1) 스타일은 반드시 인라인(외부 CSS 미적용)
 *   2) 한글 글꼴은 기본 내장 폰트로 렌더링됨
 *      (커스텀 폰트 필요 시 ArrayBuffer로 로드하여 fonts 옵션에 전달)
 *   3) 사이즈/콘텐츠 타입은 export 상수로 명시
 */
export const runtime = "edge";

import { ImageResponse } from "next/og";

/**
 * OG 권장 크기(1200×630)
 * - 페이스북/트위터 카드 공통 규격
 */
export const size = { width: 1200, height: 630 };

/**
 * 응답 MIME 타입
 * - 기본값이 png이지만 명시적으로 지정하여 혼동 방지
 */
export const contentType = "image/png";

/**
 * 기본 Open Graph 이미지 생성 함수
 * - 반환: ImageResponse(서버에서 즉시 렌더링한 비트맵)
 * - 성능: 외부 fetch 없이 순수 JSX로 구성(콜드 스타트 최소화)
 */
export default async function OG() {
  return new ImageResponse(
    (
      /**
       * 전체 캔버스 컨테이너
       * - flex column 정렬로 중앙 배치
       * - 그라디언트 배경으로 대비 확보(다크 톤)
       * - 여백(64px)과 큰 타이포로 썸네일 가독성 강화
       */
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg,#0b0f19,#0f172a)",
          color: "white",
          padding: 64,
          fontSize: 48,
          fontWeight: 700,
        }}
      >
        {/* 상단 보조 라벨(제품/플랜 등 메타 정보) */}
        <div style={{ opacity: 0.8, fontSize: 24, marginBottom: 12 }}>
          개인 프로젝트 · Vercel Hobby
        </div>

        {/* 메인 타이틀: 한눈에 메시지 전달 */}
        <div>MBTI × 사주 결합 여행지 추천</div>

        {/* 서브 카피: 핵심 가치 제안(설명 가능성·프라이버시) */}
        <div style={{ fontSize: 28, marginTop: 12, opacity: 0.9 }}>
          규칙 기반(설명 가능) · 개인정보 미저장
        </div>
      </div>
    ),
    /**
     * 렌더링 옵션
     * - 여기서도 width/height를 전달하지만, 상단 export size로 이미 고정됨
     * - 커스텀 폰트 사용 시:
     *   new ImageResponse(element, {
     *     width: 1200, height: 630,
     *     fonts: [{ name: "NotoSansKR", data: arrayBuffer, weight: 400 }]
     *   })
     */
    size
  );
}