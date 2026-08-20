import { expect, test, vi } from "vitest";
import { checkLinks, formatReport, needsRegistryUpdate } from "./check";
import type { RegistryEntry } from "./registry";

function entry(url: string, overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    section: "해외 출처",
    title: url,
    url,
    declaredStatus: "alive",
    ...overrides,
  };
}

const ok = new Response(null, { status: 200 });

test("2xx는 생존", async () => {
  const fetch = vi.fn(async () => ok);
  const results = await checkLinks([entry("https://a.test/")], { fetch });
  expect(results).toEqual([
    {
      entry: entry("https://a.test/"),
      status: "alive",
      detail: "HTTP 200",
    },
  ]);
});

test("HEAD를 막는 서버는 GET으로 다시 시도한다", async () => {
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "HEAD" ? new Response(null, { status: 405 }) : ok,
  );
  const [result] = await checkLinks([entry("https://a.test/")], { fetch });
  expect(result.status).toBe("alive");
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("404는 사망", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 404 }));
  const [result] = await checkLinks([entry("https://gone.test/")], { fetch });
  expect(result).toMatchObject({ status: "dead", detail: "HTTP 404" });
});

test("네트워크 오류도 사망으로 기록한다 — 던지지 않는다", async () => {
  const fetch = vi.fn(async () => {
    throw new Error("ENOTFOUND");
  });
  const [result] = await checkLinks([entry("https://nope.test/")], { fetch });
  expect(result).toMatchObject({ status: "dead" });
  expect(result.detail).toContain("ENOTFOUND");
});

test("등록부 순서를 유지한 결과를 돌려준다", async () => {
  const fetch = vi.fn(async (url: RequestInfo | URL) =>
    String(url).includes("b") ? new Response(null, { status: 500 }) : ok,
  );
  const results = await checkLinks(
    [entry("https://a.test/"), entry("https://b.test/"), entry("https://c.test/")],
    { fetch, concurrency: 2 },
  );
  expect(results.map((r) => `${r.entry.url} ${r.status}`)).toEqual([
    "https://a.test/ alive",
    "https://b.test/ dead",
    "https://c.test/ alive",
  ]);
});

test("리포트는 죽은 링크와 등록부 상태 불일치를 짚어 준다", () => {
  const report = formatReport([
    { entry: entry("https://a.test/"), status: "alive", detail: "HTTP 200" },
    {
      entry: entry("https://b.test/", { title: "죽은 글", declaredStatus: "alive" }),
      status: "dead",
      detail: "HTTP 404",
    },
    {
      entry: entry("https://c.test/", { title: "이미 폐기", declaredStatus: "dead" }),
      status: "dead",
      detail: "HTTP 404",
    },
  ]);

  expect(report).toContain("점검 3건 · 생존 1건 · 사망 2건");
  expect(report).toContain("죽은 글");
  expect(report).toContain("https://b.test/");
  // 등록부가 이미 dead로 적어 둔 링크는 갱신 대상이 아니다
  expect(report).toContain("등록부 갱신 필요: 1건");
});

test("전부 살아 있으면 리포트가 그렇게 말한다", () => {
  const report = formatReport([
    { entry: entry("https://a.test/"), status: "alive", detail: "HTTP 200" },
  ]);
  expect(report).toContain("점검 1건 · 생존 1건 · 사망 0건");
  expect(report).toContain("죽은 링크가 없다");
});

test("동시 실행 수를 undefined로 넘겨도 기본값으로 돌아간다", async () => {
  const fetch = vi.fn(async () => ok);
  const results = await checkLinks([entry("https://a.test/")], {
    fetch,
    concurrency: undefined,
  });
  expect(results.map((r) => r.status)).toEqual(["alive"]);
});

test("등록부 갱신 필요 판정은 실제로 죽고 등록부가 alive인 경우다", () => {
  const dead = { status: "dead", detail: "HTTP 404" } as const;
  expect(
    needsRegistryUpdate({ entry: entry("https://a.test/"), ...dead }),
  ).toBe(true);
  expect(
    needsRegistryUpdate({
      entry: entry("https://a.test/", { declaredStatus: "dead" }),
      ...dead,
    }),
  ).toBe(false);
  expect(
    needsRegistryUpdate({
      entry: entry("https://a.test/"),
      status: "alive",
      detail: "HTTP 200",
    }),
  ).toBe(false);
});
