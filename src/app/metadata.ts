import type { Metadata, Viewport } from "next";
import { siteDescription, siteName, siteUrl } from "./site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s — ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName,
    title: siteName,
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
  robots: { index: true, follow: true },
};

/** 뉴비는 게임 중 폰으로 본다 — 확대는 막지 않는다(접근성). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

