import { emptyWorldState, toWorldState, type RawWorldState } from "./adapter";
import { cycleRegionSchema, type WorldState } from "./schema";

const defaultBaseUrl =
  process.env.WORLDSTATE_API_BASE ?? "https://api.warframestat.us/pc";

/** 외부 호출을 이 시간 동안 흡수한다. */
export const WORLDSTATE_TTL_MS = 60_000;

const sectionPaths: Record<keyof RawWorldState, string> = {
  voidTrader: "voidTrader",
  earthCycle: "earthCycle",
  cetusCycle: "cetusCycle",
  fissures: "fissures",
};

export type WorldStateDeps = {
  fetch: typeof globalThis.fetch;
  now: () => number;
  baseUrl: string;
};

type CacheEntry = { state: WorldState; storedAt: number };

/** 서버 프로세스 내 마지막 성공 스냅숏. 외부 장애 때의 폴백 겸 TTL 캐시. */
let cache: CacheEntry | null = null;

/** 테스트용: 프로세스 캐시를 비운다. */
export function clearWorldStateCache(): void {
  cache = null;
}

/**
 * 월드스테이트를 가져온다. TTL 안이면 캐시를 그대로 돌려주어 외부 호출을
 * 억제하고, 외부가 죽었으면 마지막 성공 스냅숏(stale) 또는 빈 스냅숏으로
 * 폴백한다. 절대 던지지 않는다 — 위젯만 정보를 잃고 트래커는 무관하다.
 */
export async function fetchWorldState(
  overrides: Partial<WorldStateDeps> = {},
): Promise<WorldState> {
  const deps: WorldStateDeps = {
    fetch: overrides.fetch ?? globalThis.fetch,
    now: overrides.now ?? Date.now,
    baseUrl: overrides.baseUrl ?? defaultBaseUrl,
  };

  const now = deps.now();
  if (cache !== null && now - cache.storedAt < WORLDSTATE_TTL_MS) {
    return cache.state;
  }

  const previous = cache?.state ?? null;
  const sections = await fetchSections(deps);

  // 실패도 TTL 동안 흡수한다 — 외부가 죽은 동안 요청마다 재시도하지 않는다
  const state =
    sections === null
      ? previous === null
        ? emptyWorldState(now)
        : { ...previous, stale: true }
      : mergeWithPrevious(toWorldState(sections, { fetchedAt: now }), previous);

  cache = { state, storedAt: now };
  return state;
}

/**
 * 이번에 못 받은 섹션은 마지막 성공 값으로 메운다. 하나라도 메웠으면
 * 스냅숏 전체를 stale로 표시해서 위젯이 그 사실을 알린다.
 */
function mergeWithPrevious(
  fresh: WorldState,
  previous: WorldState | null,
): WorldState {
  if (previous === null) return fresh;

  let stale = false;
  let voidTrader = fresh.voidTrader;
  if (voidTrader === null && previous.voidTrader !== null) {
    voidTrader = previous.voidTrader;
    stale = true;
  }

  let fissures = fresh.fissures;
  if (fissures === null && previous.fissures !== null) {
    fissures = previous.fissures;
    stale = true;
  }

  const cycles = cycleRegionSchema.options.flatMap((region) => {
    const received = fresh.cycles.find((cycle) => cycle.region === region);
    if (received !== undefined) return [received];
    const cached = previous.cycles.find((cycle) => cycle.region === region);
    if (cached === undefined) return [];
    stale = true;
    return [cached];
  });

  return { ...fresh, voidTrader, cycles, fissures, stale };
}

/** 섹션별로 받아온다. 하나도 못 받으면 null(=외부 장애). */
async function fetchSections(deps: WorldStateDeps): Promise<RawWorldState | null> {
  const keys = Object.keys(sectionPaths) as (keyof RawWorldState)[];
  const results = await Promise.all(
    keys.map((key) => fetchSection(deps, sectionPaths[key])),
  );

  const sections: RawWorldState = {};
  let received = 0;
  results.forEach((value, index) => {
    if (value !== null) {
      sections[keys[index]] = value;
      received += 1;
    }
  });

  return received === 0 ? null : sections;
}

async function fetchSection(
  deps: WorldStateDeps,
  path: string,
): Promise<unknown> {
  try {
    const response = await deps.fetch(`${deps.baseUrl}/${path}`, {
      // Next.js 데이터 캐시로 외부 호출을 한 번 더 흡수한다
      next: { revalidate: WORLDSTATE_TTL_MS / 1000 },
      signal: AbortSignal.timeout(5_000),
    } as RequestInit);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
