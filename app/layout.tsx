import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

/**
 * Google Fonts (next/font)
 * - 장점: 자동 서브셋/최적화, FOUT/FOIT 최소화, CSS-in-JS 번들 관리 불필요
 * - 주의: 런타임 옵션 변경은 렌더링 영향 → 필요 시 빌드 타임에 고정
 * - subsets: 라틴 알파벳만 사용한다면 ["latin"]으로 최소화
 *   (한국어 본문은 시스템 폰트/프로젝트 폰트를 별도 사용)
 */
const inter = Inter({ subsets: ["latin"] });

/**
 * 사이트 기본 URL
 * - 배포 시 Vercel 프로젝트 환경변수에 NEXT_PUBLIC_SITE_URL 설정 권장
 *   예: https://example.com  (스킴 포함·슬래시 없음)
 * - metadataBase에는 절대 URL이 필요하므로 new URL()로 보장
 * - 로컬 개발 시 기본값: http://localhost:3000
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Next.js App Router 메타데이터
 * - metadataBase: 상대 경로 OG/트위터 이미지의 절대 URL 변환 기준
 * - openGraph / twitter: SNS 공유(미리보기 카드) 품질 개선
 *   images: "/opengraph-image"는 app/opengraph-image.tsx 라우트가 있다고 가정
 * - title/description: 페이지 전역 기본값 (개별 페이지에서 오버라이드 가능)
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MBTI × 사주 결합 여행지 추천",
  description:
    "MBTI 성향 + 오행(사주) 보정으로 개인화된 여행지 추천 — 개인정보 미저장, Edge 런타임.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "MBTI × 사주 결합 여행지 추천",
    description: "MBTI 성향 + 오행 보정으로 여행지 추천",
    images: ["/opengraph-image"], // 동적 OG 이미지 라우트(예: app/opengraph-image.tsx)
  },
  twitter: {
    card: "summary_large_image",
    title: "MBTI × 사주 결합 여행지 추천",
    description: "MBTI 성향 + 오행 보정으로 여행지 추천",
    images: ["/opengraph-image"],
  },
};

/**
 * 루트 레이아웃
 * - <html lang="ko">: SEO/접근성(스크린리더) 언어 힌트
 * - body class:
 *   - inter.className: next/font로 불러온 폰트 적용
 *   - antialiased: Tailwind 유틸(가독성 향상용 폰트 스무딩)
 * - children: 모든 페이지/섹션이 여기로 렌더링
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}