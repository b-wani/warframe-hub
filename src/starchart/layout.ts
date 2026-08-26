/**
 * 좌표 데이터셋(`src/data/starchart-layout.json`)의 스키마·검증·생성.
 *
 * 좌표는 어느 공개 소스에도 없어서 수동 큐레이션 대상이다(스펙 §3.2).
 * 생성 스크립트가 초기 배치를 만들고, 그 뒤 보정은 JSON을 에디터에서 직접
 * 고치는 워크플로를 따른다 — 그래서 재생성은 기본적으로 기존 좌표를 보존하고
 * 빠진 것만 채운다.
 *
 * 좌표계
 * - `groups`: 성계 뷰의 천체 위치. 원점(0,0)이 태양이다.
 * - `nodes`: 자기 그룹 안에서의 상대 위치. 원점(0,0)이 그룹 중심이다 —
 *   천체를 옮겨도 노드 구름이 따라 움직인다.
 */
import { z } from "zod";
import { buildCelestialPositions } from "./celestial.ts";
import { placedGroupIds, placedNodesByGroup, type StarchartDataset } from "./dataset.ts";
import { runForceLayout, type Point } from "./force-layout.ts";

export const pointSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
});

export const starchartLayoutSchema = z.strictObject({
  groups: z.record(z.string(), pointSchema),
  nodes: z.record(z.string(), pointSchema),
});

export type StarchartLayout = z.infer<typeof starchartLayoutSchema>;

export class StarchartLayoutValidationError extends Error {
  constructor(issues: string[]) {
    super(`좌표 데이터셋 검증 실패:\n${issues.map((i) => `- ${i}`).join("\n")}`);
    this.name = "StarchartLayoutValidationError";
  }
}

/**
 * 좌표 데이터셋이 정제 노드 데이터셋과 맞는지 본다. 좌표가 빠진 노드·그룹과
 * 가리킬 대상이 없는 고아 좌표를 전부 모아 돌려준다 (빈 배열이면 통과).
 */
export function validateLayout(
  dataset: StarchartDataset,
  layout: StarchartLayout,
): string[] {
  const issues: string[] = [];
  const byGroup = placedNodesByGroup(dataset);

  for (const groupId of byGroup.keys()) {
    if (!(groupId in layout.groups)) {
      issues.push(`그룹 "${groupId}"의 좌표가 없다`);
    }
  }
  for (const members of byGroup.values()) {
    for (const { id } of members) {
      if (!(id in layout.nodes)) issues.push(`노드 "${id}"의 좌표가 없다`);
    }
  }
  for (const groupId of Object.keys(layout.groups)) {
    if (byGroup.has(groupId)) continue;
    issues.push(
      groupId in dataset.groups
        ? `고아 그룹 좌표 "${groupId}" — 릴레이 그룹은 지도에서 숨기므로 좌표 대상이 아니다`
        : `고아 그룹 좌표 "${groupId}" — 데이터셋에 없는 그룹이다`,
    );
  }
  for (const nodeId of Object.keys(layout.nodes)) {
    const node = dataset.nodes[nodeId];
    if (node && byGroup.has(node.group)) continue;
    issues.push(
      node
        ? `고아 노드 좌표 "${nodeId}" — 릴레이 그룹의 노드다`
        : `고아 노드 좌표 "${nodeId}" — 데이터셋에 없는 노드다`,
    );
  }
  return issues;
}

/**
 * 좌표 데이터셋을 검증해서 돌려준다. 스키마 위반, 빠진 좌표, 고아 좌표가 있으면
 * 모든 문제를 모아 StarchartLayoutValidationError로 실패한다.
 */
export function loadStarchartLayout(
  dataset: StarchartDataset,
  raw: unknown,
): StarchartLayout {
  const parsed = starchartLayoutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StarchartLayoutValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(최상위)"}: ${issue.message}`,
      ),
    );
  }
  const issues = validateLayout(dataset, parsed.data);
  if (issues.length > 0) throw new StarchartLayoutValidationError(issues);
  return parsed.data;
}

/**
 * 초기 배치를 만든다. `existing`에 이미 있는 좌표는 그대로 두고 빠진 것만
 * 채우므로, 수동 보정을 잃지 않고 게임 패치로 늘어난 노드만 받을 수 있다.
 * 데이터셋에서 사라진 좌표는 걷어낸다(`removed`).
 *
 * 키 순서는 언제나 데이터셋 순서라 재실행 diff가 좌표 변경만 보여준다.
 */
export function buildLayout(
  dataset: StarchartDataset,
  existing: StarchartLayout = { groups: {}, nodes: {} },
): {
  layout: StarchartLayout;
  issues: string[];
  added: string[];
  removed: string[];
} {
  const added: string[] = [];
  const groupIds = placedGroupIds(dataset);
  const { positions, issues } = buildCelestialPositions(groupIds);

  const groups: Record<string, Point> = {};
  for (const groupId of groupIds) {
    const kept = existing.groups[groupId];
    const generated = positions[groupId];
    if (kept) groups[groupId] = kept;
    else if (generated) {
      groups[groupId] = generated;
      added.push(groupId);
    }
  }

  const nodes: Record<string, Point> = {};
  for (const [, members] of placedNodesByGroup(dataset)) {
    const missing = members.filter(({ id }) => !existing.nodes[id]);
    // 이미 손본 좌표를 흔들지 않도록, 빠진 노드가 있는 그룹만 다시 계산한다
    const generated = missing.length > 0 ? runForceLayout(members) : {};
    for (const { id } of members) {
      const kept = existing.nodes[id];
      if (kept) nodes[id] = kept;
      else {
        nodes[id] = generated[id];
        added.push(id);
      }
    }
  }

  const removed = [
    ...Object.keys(existing.groups).filter((id) => !(id in groups)),
    ...Object.keys(existing.nodes).filter((id) => !(id in nodes)),
  ];
  return { layout: { groups, nodes }, issues, added, removed };
}

/**
 * 좌표 데이터셋을 파일로 쓸 문자열로 만든다. 좌표 하나가 한 줄이라 에디터에서
 * 고치기 쉽고, 재생성 diff가 바뀐 좌표 줄만 보여준다.
 */
export function formatLayout(layout: StarchartLayout): string {
  const section = (entries: Record<string, Point>): string => {
    const lines = Object.entries(entries).map(
      ([id, p]) => `    ${JSON.stringify(id)}: { "x": ${p.x}, "y": ${p.y} }`,
    );
    return lines.length === 0 ? "{}" : `{\n${lines.join(",\n")}\n  }`;
  };
  return `{\n  "groups": ${section(layout.groups)},\n  "nodes": ${section(layout.nodes)}\n}\n`;
}
