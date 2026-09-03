/**
 * 정제 노드 데이터셋 빌드 (수동 실행 + diff 검수).
 *
 *   pnpm build:starchart                          업스트림에서 받아 생성
 *   pnpm build:starchart --regions=a.json --dict=b.json --dict-en=c.json
 *                                                 로컬 파일로 생성
 *
 * 업스트림 warframe-public-export-plus의 ExportRegions.json(노드 그래프)과
 * dict.ko.json(공식 한국어 사전) + dict.en.json(영문 사전)을 합쳐
 * src/data/starchart.json 하나를 만든다. 사전·원형 JSON은 커밋하지 않으며, 앱은
 * 산출물만 임포트한다.
 *
 * 영문 표시명(`enName`)을 함께 인라인하는 이유는 월드스테이트다 — 외부 API가
 * 노드를 SolNode id가 아니라 영문 표시명으로만 알려주므로(스펙 §6), 대조할 이름이
 * 데이터셋 안에 있어야 균열을 노드에 붙일 수 있다.
 *
 * 언어 키가 사전에 없거나 팩션 enum이 수동 매핑에 없거나 영문 표시명이 겹치면
 * 실패한다 — 매핑 실패가 화면에 도달하기 전에 여기서 드러나야 한다.
 */
import { readFile, writeFile } from "node:fs/promises";

const UPSTREAM =
  "https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai";
const OUT_PATH = "src/data/starchart.json";

// 그룹 유형 4분류 (#26). 그룹 id는 systemName 마지막 세그먼트.
const SPECIAL_GROUPS = new Set([
  "Void",
  "Fortress",
  "ZarimanRegionName",
  "Duviri",
  "1999MapName",
]);
const RELAY_GROUPS = new Set(["RelayStationSanctuary"]);
const groupType = (groupId: string): string => {
  if (groupId.endsWith("_SPACE")) return "proxima";
  if (SPECIAL_GROUPS.has(groupId)) return "special";
  if (RELAY_GROUPS.has(groupId)) return "relay";
  return "planet";
};

// faction은 언어 키가 아닌 enum — 소형 수동 매핑 (#26).
const FACTIONS: Record<string, string> = {
  FC_GRINEER: "그리니어",
  FC_CORPUS: "코퍼스",
  FC_INFESTATION: "인페스티드",
  FC_OROKIN: "오로킨",
  FC_SENTIENT: "센티언트",
  FC_TENNO: "텐노",
  FC_DUVIRI: "두비리",
  FC_MITW: "머머",
  FC_SCALDRA: "스칼드라",
  FC_TECHROT: "테크롯",
};

type RawNode = {
  name: string;
  systemName: string;
  nodeType: number;
  missionType?: string;
  missionName?: string;
  faction?: string;
  minEnemyLevel?: number;
  maxEnemyLevel?: number;
  masteryReq?: number;
  hidden?: boolean;
  nextNodes?: string[];
};

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v] as const;
    }),
);

async function load(name: string, localFlag: string): Promise<unknown> {
  const local = args.get(localFlag);
  if (local) return JSON.parse(await readFile(local, "utf8"));
  const url = `${UPSTREAM}/${name}`;
  process.stderr.write(`${url} 내려받는 중…\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

const [regions, dict, enDict] = (await Promise.all([
  load("ExportRegions.json", "regions"),
  load("dict.ko.json", "dict"),
  load("dict.en.json", "dict-en"),
])) as [Record<string, RawNode>, Record<string, string>, Record<string, string>];

const errors: string[] = [];
const displayName = (langKey: string): string => {
  const value = dict[langKey];
  if (!value) errors.push(`사전에 없는 언어 키: ${langKey}`);
  // 런타임 폴백과 같은 규칙(마지막 세그먼트)이지만, 여기 도달하면 어차피 실패한다
  return value ?? langKey.split("/").pop() ?? langKey;
};
const enName = (langKey: string): string => {
  const value = enDict[langKey];
  if (!value) errors.push(`영문 사전에 없는 언어 키: ${langKey}`);
  return value ?? langKey.split("/").pop() ?? langKey;
};
const lastSegment = (path: string) => path.split("/").pop() ?? path;

const groups: Record<string, { name: string; type: string }> = {};
const nodes: Record<
  string,
  {
    name: string;
    enName: string;
    group: string;
    missionType?: string;
    missionName?: string;
    faction?: string;
    factionName?: string;
    minEnemyLevel?: number;
    maxEnemyLevel?: number;
    masteryReq: number;
    hidden?: boolean;
    nextNodes: string[];
  }
> = {};

for (const [id, raw] of Object.entries(regions)) {
  const groupId = lastSegment(raw.systemName);
  groups[groupId] ??= {
    name: displayName(raw.systemName),
    type: groupType(groupId),
  };
  let factionName: string | undefined;
  if (raw.faction) {
    factionName = FACTIONS[raw.faction];
    if (!factionName) errors.push(`팩션 수동 매핑에 없는 값: ${raw.faction} (${id})`);
  }
  nodes[id] = {
    name: displayName(raw.name),
    enName: enName(raw.name),
    group: groupId,
    missionType: raw.missionType,
    missionName: raw.missionName ? displayName(raw.missionName) : undefined,
    faction: raw.faction,
    factionName,
    minEnemyLevel: raw.minEnemyLevel,
    maxEnemyLevel: raw.maxEnemyLevel,
    masteryReq: raw.masteryReq ?? 0,
    hidden: raw.hidden || undefined,
    nextNodes: raw.nextNodes ?? [],
  };
}

// 영문 표시명이 겹치면 균열을 어느 노드에 붙일지 정할 수 없다 — 이름 대조가
// 성립하는 근거를 여기서 지킨다
const byEnName = new Map<string, string[]>();
for (const [id, node] of Object.entries(nodes)) {
  const bucket = byEnName.get(node.enName);
  if (bucket) bucket.push(id);
  else byEnName.set(node.enName, [id]);
}
for (const [name, ids] of byEnName) {
  if (ids.length > 1) errors.push(`영문 표시명이 겹침: ${name} (${ids.join(", ")})`);
}

// 간선이 데이터셋 밖을 가리키면 그래프 파생(진행도 3상태)이 깨진다
for (const [id, node] of Object.entries(nodes)) {
  for (const next of node.nextNodes) {
    if (!nodes[next]) errors.push(`nextNodes가 없는 노드를 가리킴: ${id} → ${next}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `✗ ${e}\n`).join(""));
  process.exit(1);
}

const byType: Record<string, number> = {};
for (const g of Object.values(groups)) byType[g.type] = (byType[g.type] ?? 0) + 1;

await writeFile(OUT_PATH, `${JSON.stringify({ groups, nodes }, null, 2)}\n`);
process.stderr.write(
  `${OUT_PATH}: 노드 ${Object.keys(nodes).length}개, 그룹 ${Object.keys(groups).length}개 ` +
    `(${Object.entries(byType)
      .map(([t, n]) => `${t} ${n}`)
      .join(", ")})\n`,
);
