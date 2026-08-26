import { expect, test } from "vitest";
import { metadata, viewport } from "./metadata";
import robots from "./robots";
import sitemap from "./sitemap";
import { siteUrl } from "./site";

test("루트 메타데이터에 제목 템플릿·설명·OG가 있다", () => {
  expect(metadata.title).toMatchObject({
    default: "워프레임 허브",
    template: "%s — 워프레임 허브",
  });
  expect(metadata.description).toBeTruthy();
  expect(String(metadata.metadataBase)).toBe(`${siteUrl}/`);
  expect(metadata.openGraph).toMatchObject({
    type: "website",
    locale: "ko_KR",
    siteName: "워프레임 허브",
  });
  expect(metadata.openGraph?.title).toBeTruthy();
  expect(metadata.openGraph?.description).toBeTruthy();
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
});

test("모바일 뷰포트가 선언되어 있고 확대를 막지 않는다", () => {
  expect(viewport).toMatchObject({ width: "device-width", initialScale: 1 });
  expect(viewport).not.toHaveProperty("maximumScale");
  expect(viewport).not.toHaveProperty("userScalable");
});

test("robots.txt는 전체 색인을 허용하고 사이트맵을 가리킨다", () => {
  expect(robots()).toMatchObject({
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  });
});

test("사이트맵에 홈이 들어 있다", () => {
  expect(sitemap().map((entry) => entry.url)).toEqual([`${siteUrl}/`]);
});
