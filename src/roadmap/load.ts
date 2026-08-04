import { z } from "zod";
import {
  roadmapNodeSchema,
  sourceSchema,
  type Roadmap,
  type RoadmapNode,
} from "./schema";

export class RoadmapValidationError extends Error {
  constructor(issues: string[]) {
    super(`로드맵 데이터 검증 실패:\n${issues.map((i) => `- ${i}`).join("\n")}`);
    this.name = "RoadmapValidationError";
  }
}

const nodesInputSchema = z.array(roadmapNodeSchema);
const sourcesInputSchema = z.array(sourceSchema);

/**
 * 로드맵 데이터를 검증해서 돌려준다. 스키마 위반, 중복 id, 존재하지 않는
 * 선행조건·출처 참조, 순환 의존이 있으면 모든 문제를 모아
 * RoadmapValidationError 로 실패한다.
 */
export function loadRoadmap(input: {
  nodes: unknown;
  sources: unknown;
}): Roadmap {
  const nodesResult = nodesInputSchema.safeParse(input.nodes);
  const sourcesResult = sourcesInputSchema.safeParse(input.sources);

  if (!nodesResult.success || !sourcesResult.success) {
    const issues = [
      ...(nodesResult.success
        ? []
        : formatSchemaIssues("노드", nodesResult.error, input.nodes)),
      ...(sourcesResult.success
        ? []
        : formatSchemaIssues("출처", sourcesResult.error, input.sources)),
    ];
    throw new RoadmapValidationError(issues);
  }

  const nodes = nodesResult.data;
  const sources = sourcesResult.data;
  const issues = [
    ...findDuplicateIds(nodes.map((n) => n.id), "노드"),
    ...findDuplicateIds(sources.map((s) => s.id), "출처"),
    ...findBrokenReferences(nodes, new Set(sources.map((s) => s.id))),
    ...findCycles(nodes),
  ];
  if (issues.length > 0) {
    throw new RoadmapValidationError(issues);
  }

  return { nodes, sources };
}

function formatSchemaIssues(
  label: string,
  error: z.ZodError,
  rawInput: unknown,
): string[] {
  return error.issues.map((issue) => {
    const [index, ...rest] = issue.path;
    const id =
      Array.isArray(rawInput) && typeof index === "number"
        ? idOf(rawInput[index])
        : undefined;
    const where = id ? `${label} "${id}"` : `${label}[${String(index ?? "?")}]`;
    const field = rest.length > 0 ? ` ${rest.join(".")}:` : "";
    return `${where}:${field} ${issue.message}`;
  });
}

function idOf(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function findDuplicateIds(ids: string[], label: string): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push(`${label} id "${id}"가 중복 정의되었다`);
    }
    seen.add(id);
  }
  return issues;
}

function findBrokenReferences(
  nodes: RoadmapNode[],
  sourceIds: Set<string>,
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const issues: string[] = [];
  for (const node of nodes) {
    for (const prereq of node.prerequisites) {
      if (!nodeIds.has(prereq)) {
        issues.push(
          `노드 "${node.id}"의 선행조건 "${prereq}"가 존재하지 않는다`,
        );
      }
    }
    for (const sourceId of node.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        issues.push(`노드 "${node.id}"의 출처 "${sourceId}"가 존재하지 않는다`);
      }
    }
  }
  return issues;
}

function findCycles(nodes: RoadmapNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, "visiting" | "done">();
  const issues: string[] = [];

  function visit(id: string, path: string[]): void {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      const cycle = [...path.slice(path.indexOf(id)), id];
      issues.push(`순환 의존이 있다: ${cycle.join(" → ")}`);
      return;
    }
    state.set(id, "visiting");
    for (const prereq of byId.get(id)?.prerequisites ?? []) {
      if (byId.has(prereq)) visit(prereq, [...path, id]);
    }
    state.set(id, "done");
  }

  for (const node of nodes) {
    visit(node.id, []);
  }
  return issues;
}
