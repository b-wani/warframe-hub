import type { RegistryEntry } from "./registry";

export type LinkStatus = "alive" | "dead";

export type LinkResult = {
  entry: RegistryEntry;
  status: LinkStatus;
  /** 판정 근거 — "HTTP 404" 또는 네트워크 오류 메시지 */
  detail: string;
};

export type CheckDeps = {
  fetch: typeof globalThis.fetch;
  /** 동시에 날리는 요청 수. 출처 서버를 두드리지 않도록 낮게 잡는다. */
  concurrency: number;
  timeoutMs: number;
};

const defaultConcurrency = 4;
const defaultTimeoutMs = 10_000;

/**
 * 등록부 URL의 생존 여부를 점검한다. 절대 던지지 않는다 — 네트워크 오류도
 * 결과 한 줄(dead)로 기록해서, 운영자가 리포트 하나로 전부 볼 수 있게 한다.
 * 결과는 입력(등록부) 순서를 유지한다.
 */
export async function checkLinks(
  entries: RegistryEntry[],
  overrides: Partial<CheckDeps> = {},
): Promise<LinkResult[]> {
  const deps: CheckDeps = {
    fetch: overrides.fetch ?? globalThis.fetch,
    concurrency: overrides.concurrency ?? defaultConcurrency,
    timeoutMs: overrides.timeoutMs ?? defaultTimeoutMs,
  };
  const results: LinkResult[] = new Array(entries.length);
  let next = 0;

  const worker = async () => {
    while (next < entries.length) {
      const index = next++;
      results[index] = await checkOne(entries[index], deps);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(deps.concurrency, entries.length) }, worker),
  );

  return results;
}

/** HEAD로 물어보고, HEAD를 막는 서버는 GET으로 한 번 더 확인한다. */
async function checkOne(
  entry: RegistryEntry,
  deps: CheckDeps,
): Promise<LinkResult> {
  const head = await request(entry.url, "HEAD", deps);
  if ("response" in head && head.response.ok) {
    return alive(entry, head.response);
  }

  const get = await request(entry.url, "GET", deps);
  // 응답을 받은 쪽(GET 우선)을 판정 근거로 쓴다. 둘 다 못 받았으면 오류 메시지가 근거다.
  const attempt = "response" in get ? get : "response" in head ? head : get;

  if ("error" in attempt) {
    return { entry, status: "dead", detail: attempt.error };
  }
  return attempt.response.ok
    ? alive(entry, attempt.response)
    : { entry, status: "dead", detail: `HTTP ${attempt.response.status}` };
}

function alive(entry: RegistryEntry, response: Response): LinkResult {
  return { entry, status: "alive", detail: `HTTP ${response.status}` };
}

type Attempt = { response: Response } | { error: string };

async function request(
  url: string,
  method: "HEAD" | "GET",
  deps: CheckDeps,
): Promise<Attempt> {
  try {
    const response = await deps.fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    return { response };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 등록부 갱신이 필요한 결과 — 실제로 죽었는데 등록부에는 dead로 적혀 있지 않은 것.
 * 리포트 문구와 스크립트 종료 코드가 같은 정의를 쓰도록 여기 한 곳에 둔다.
 */
export function needsRegistryUpdate(result: LinkResult): boolean {
  return result.status === "dead" && result.entry.declaredStatus !== "dead";
}

/** 점검 결과를 운영자가 읽는 마크다운 리포트로 만든다. */
export function formatReport(results: LinkResult[]): string {
  const dead = results.filter((r) => r.status === "dead");
  const stale = dead.filter(needsRegistryUpdate);
  const lines = [
    "# 링크 생존 점검 리포트",
    "",
    `점검 ${results.length}건 · 생존 ${results.length - dead.length}건 · 사망 ${dead.length}건`,
    "",
  ];

  if (dead.length === 0) {
    lines.push("죽은 링크가 없다.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## 죽은 링크", "");
  for (const result of dead) {
    const note = needsRegistryUpdate(result) ? "" : " (등록부에 이미 dead)";
    lines.push(
      `- [${result.entry.section}] ${result.entry.title} — ${result.detail}${note}`,
      `  ${result.entry.url}`,
    );
  }
  lines.push("", `등록부 갱신 필요: ${stale.length}건`);

  return `${lines.join("\n")}\n`;
}
