import type { Source } from "@/roadmap/schema";

/** 점검 대상 URL 하나 — 출처 등록부의 한 행 또는 페이지 크레딧 한 건. */
export type RegistryEntry = {
  /** 등록부 안의 소제목 (예: "해외 출처") */
  section: string;
  title: string;
  url: string;
  /** 등록부에 사람이 적어 둔 상태. 점검 결과와 어긋나면 갱신이 필요하다. */
  declaredStatus: string;
};

const headingPattern = /^##\s+(.+?)\s*$/;
const urlPattern = /https?:\/\/\S+/;

/**
 * 등록부 마크다운에서 점검 대상 행을 뽑는다. 표의 열 순서는
 * 출처 | URL | 수집일 | 상태 | 비고 로 고정이며, URL 칸에 URL이 없는
 * 행(로컬 보관 파일 등)은 점검 대상이 아니므로 버린다.
 */
export function parseRegistry(markdown: string): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  let section = "";

  for (const line of markdown.split("\n")) {
    const heading = headingPattern.exec(line);
    if (heading !== null) {
      section = heading[1];
      continue;
    }

    const cells = tableCells(line);
    if (cells === null) continue;

    const [title, urlCell, , declaredStatus] = cells;
    const url = urlPattern.exec(urlCell ?? "")?.[0];
    if (url === undefined) continue;

    entries.push({
      section,
      title,
      url,
      declaredStatus: declaredStatus ?? "",
    });
  }

  return entries;
}

/** 표 행이면 셀 배열, 아니면 null. 헤더 행과 구분선도 null로 걸러 낸다. */
function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;

  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  if (cells.every((cell) => /^-+$/.test(cell))) return null;

  return cells;
}

/**
 * 페이지 크레딧(`src/data/sources.json`)을 점검 대상으로 만든다. 등록부에는
 * 확인용 출처까지 전부 들어 있지만 크레딧에만 있는 URL도 있고, 크레딧은 유저에게
 * 실제로 노출되는 링크라 죽으면 바로 신뢰도를 깎는다 — 둘 다 점검해야 한다.
 */
export function creditEntries(sources: Source[]): RegistryEntry[] {
  return sources.map((source) => ({
    section: "페이지 크레딧",
    title: source.title,
    url: source.url,
    declaredStatus: source.status,
  }));
}

/** 여러 출처 목록을 URL 기준으로 합친다. 같은 URL은 먼저 온 쪽을 남긴다. */
export function mergeEntries(...lists: RegistryEntry[][]): RegistryEntry[] {
  const byUrl = new Map<string, RegistryEntry>();
  for (const entry of lists.flat()) {
    if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  }
  return [...byUrl.values()];
}
