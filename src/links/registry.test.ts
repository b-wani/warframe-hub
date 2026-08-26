import { expect, test } from "vitest";
import {
  creditEntries,
  mergeEntries,
  parseRegistry,
  type Source,
} from "./registry";

test("표에서 제목·URL·선언 상태를 뽑는다", () => {
  const markdown = `# 출처 등록부

## 해외 출처

| 출처 | URL | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 공식 위키 — Rhino | https://wiki.warframe.com/w/Rhino | 2026-08-04 | alive | 부품 |
`;
  expect(parseRegistry(markdown)).toEqual([
    {
      section: "해외 출처",
      title: "공식 위키 — Rhino",
      url: "https://wiki.warframe.com/w/Rhino",
      declaredStatus: "alive",
    },
  ]);
});

test("URL 칸에 설명이 붙어 있으면 첫 URL만 쓴다", () => {
  const markdown = `## 해외 출처

| 출처 | URL | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 개별 7페이지 | https://wiki.warframe.com/w/Venus_Junction 외 | 2026-08-04 | alive | |
`;
  expect(parseRegistry(markdown)[0].url).toBe(
    "https://wiki.warframe.com/w/Venus_Junction",
  );
});

test("URL이 없는 행(로컬 파일 출처)은 점검 대상이 아니다", () => {
  const markdown = `## 국내 출처

| 출처 | URL/파일 | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 오디스 코덱스 v3.5 | 운영자 제공 사본, 로컬 보관 | 2026-08-04 | alive | |
| 커뮤니티 시트 | https://docs.google.com/spreadsheets/d/x/htmlview | 2026-08-20 | alive | |
`;
  expect(parseRegistry(markdown).map((e) => e.title)).toEqual(["커뮤니티 시트"]);
});

test("표 밖의 파이프 문장과 구분선은 무시한다", () => {
  const markdown = `## 수집 방법

- 위키는 raw로 받았다 (a | b)

## 해외 출처

| 출처 | URL | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 위키 | https://wiki.warframe.com/ | 2026-08-04 | dead | 사라짐 |
`;
  expect(parseRegistry(markdown)).toEqual([
    {
      section: "해외 출처",
      title: "위키",
      url: "https://wiki.warframe.com/",
      declaredStatus: "dead",
    },
  ]);
});

test("실제 등록부를 파싱하면 해외·국내 출처가 모두 나온다", async () => {
  const { readFile } = await import("node:fs/promises");
  const markdown = await readFile("sources/README.md", "utf8");
  const entries = parseRegistry(markdown);
  expect(entries.length).toBeGreaterThan(10);
  expect(entries.every((e) => e.url.startsWith("http"))).toBe(true);
  expect(new Set(entries.map((e) => e.section))).toEqual(
    new Set(["해외 출처", "국내 출처"]),
  );
});

test("페이지 크레딧(sources.json)도 점검 대상으로 만든다", () => {
  expect(
    creditEntries([
      {
        id: "wiki-rhino",
        title: "공식 위키 — Rhino",
        url: "https://wiki.warframe.com/w/Rhino",
        collectedAt: "2026-08-04",
        status: "alive",
      },
    ]),
  ).toEqual([
    {
      section: "페이지 크레딧",
      title: "공식 위키 — Rhino",
      url: "https://wiki.warframe.com/w/Rhino",
      declaredStatus: "alive",
    },
  ]);
});

test("등록부와 크레딧을 합칠 때 같은 URL은 한 번만 점검한다", () => {
  const registry = parseRegistry(`## 해외 출처

| 출처 | URL | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 위키 Rhino | https://wiki.warframe.com/w/Rhino | 2026-08-04 | alive | |
`);
  const credits = creditEntries([
    {
      id: "wiki-rhino",
      title: "공식 위키 — Rhino",
      url: "https://wiki.warframe.com/w/Rhino",
      collectedAt: "2026-08-04",
      status: "alive",
    },
    {
      id: "wiki-venus",
      title: "공식 위키 — Venus Junction",
      url: "https://wiki.warframe.com/w/Venus_Junction",
      collectedAt: "2026-08-04",
      status: "alive",
    },
  ]);

  const merged = mergeEntries(registry, credits);
  expect(merged.map((e) => e.url)).toEqual([
    "https://wiki.warframe.com/w/Rhino",
    "https://wiki.warframe.com/w/Venus_Junction",
  ]);
  // 먼저 온 쪽(등록부)의 제목·상태를 유지한다 — 운영 기록이 기준이다
  expect(merged[0]).toMatchObject({ section: "해외 출처", title: "위키 Rhino" });
});

test("실제 크레딧 데이터의 모든 URL이 점검 대상에 들어간다", async () => {
  const { readFile } = await import("node:fs/promises");
  const [markdown, credits] = await Promise.all([
    readFile("sources/README.md", "utf8"),
    readFile("src/data/sources.json", "utf8").then(
      (json) => JSON.parse(json) as Source[],
    ),
  ]);
  const merged = mergeEntries(parseRegistry(markdown), creditEntries(credits));
  const checked = new Set(merged.map((e) => e.url));
  for (const credit of credits) {
    expect(checked, credit.id).toContain(credit.url);
  }
});
