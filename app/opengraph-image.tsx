export const runtime = "edge";

import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
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
        <div style={{ opacity: 0.8, fontSize: 24, marginBottom: 12 }}>
          개인 프로젝트 · Vercel Hobby
        </div>
        <div>MBTI × 사주 여행 추천</div>
        <div style={{ fontSize: 28, marginTop: 12, opacity: 0.9 }}>
          규칙 기반(설명 가능) · 개인정보 미저장
        </div>
      </div>
    ),
    size
  );
}