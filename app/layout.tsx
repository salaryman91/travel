import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

// 배포 시 Vercel 대시보드에 NEXT_PUBLIC_SITE_URL 설정 권장
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MBTI × 사주 여행 추천",
  description:
    "MBTI 성향 + 오행(사주) 보정으로 개인화된 여행지 추천 — 개인정보 미저장, Edge 런타임.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "MBTI × 사주 여행 추천",
    description: "MBTI 성향 + 오행 보정으로 여행지 추천",
    images: ["/opengraph-image"], // 동적 OG 이미지 라우트
  },
  twitter: {
    card: "summary_large_image",
    title: "MBTI × 사주 여행 추천",
    description: "MBTI 성향 + 오행 보정으로 여행지 추천",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}