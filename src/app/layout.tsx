import { Geist } from "next/font/google";
import "./globals.css";

// 메타데이터는 별도 모듈에 둔다 — 폰트 로더 없이도(단위 테스트) 검증할 수 있게.
export { metadata, viewport } from "./metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
