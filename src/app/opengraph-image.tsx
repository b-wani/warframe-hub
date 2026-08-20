import { ImageResponse } from "next/og";
import { siteDescription, siteName } from "./site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${siteName} — 한국 워프레임 뉴비 진행 트래커`;

/** 링크 공유 미리보기 이미지. 외부 폰트를 받지 않고 빌드된다. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: "0 80px",
          background: "#0b1622",
          color: "#f5f7fa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <path d="M32 12 52 50H40L32 34 24 50H12Z" fill="#f0a93b" />
          </svg>
          <div style={{ fontSize: 76, fontWeight: 700 }}>{siteName}</div>
        </div>
        <div style={{ fontSize: 36, color: "#aebbcb", lineHeight: 1.4 }}>
          {siteDescription}
        </div>
      </div>
    ),
    size,
  );
}
