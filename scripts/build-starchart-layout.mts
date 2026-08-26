/**
 * 좌표 데이터셋 빌드 (수동 실행 + diff 검수).
 *
 *   pnpm build:starchart-layout              빠진 좌표만 채운다 (수동 보정 보존)
 *   pnpm build:starchart-layout --regenerate 전부 다시 계산한다 (수동 보정 폐기)
 *   pnpm build:starchart-layout --check      파일을 쓰지 않고 검증만 한다
 *
 * 정제 노드 데이터셋(src/data/starchart.json)의 노드·그룹에 화면 배치 좌표를
 * 붙여 src/data/starchart-layout.json을 만든다. 좌표는 어느 공개 소스에도 없어
 * 수동 큐레이션 대상이며(스펙 §3.2), 이 스크립트는 손보기 좋은 출발점만 만든다.
 *
 * 보정 워크플로는 docs/starchart-layout-workflow.md 참고.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { StarchartDataset } from "../src/starchart/dataset.ts";
import {
  buildLayout,
  formatLayout,
  starchartLayoutSchema,
  validateLayout,
  type StarchartLayout,
} from "../src/starchart/layout.ts";

const DATASET_PATH = "src/data/starchart.json";
const OUT_PATH = "src/data/starchart-layout.json";

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const regenerate = flags.has("--regenerate");
const checkOnly = flags.has("--check");

function fail(issues: string[]): never {
  process.stderr.write(issues.map((i) => `✗ ${i}\n`).join(""));
  process.exit(1);
}

const dataset = JSON.parse(
  await readFile(DATASET_PATH, "utf8"),
) as StarchartDataset;

async function readExistingLayout(): Promise<StarchartLayout> {
  const empty: StarchartLayout = { groups: {}, nodes: {} };
  let text: string;
  try {
    text = await readFile(OUT_PATH, "utf8");
  } catch {
    return empty;
  }
  const parsed = starchartLayoutSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    // 손으로 고치다 깨진 파일을 조용히 덮어쓰면 보정이 통째로 날아간다
    fail(
      parsed.error.issues.map(
        (i) => `${OUT_PATH} ${i.path.join(".") || "(최상위)"}: ${i.message}`,
      ),
    );
  }
  return parsed.data;
}

// --check은 손으로 고친 파일을 그대로 본다 — --regenerate와 겹쳐도 검증이 먼저다
if (checkOnly) {
  const issues = validateLayout(dataset, await readExistingLayout());
  if (issues.length > 0) fail(issues);
  process.stderr.write(`${OUT_PATH}: 검증 통과\n`);
  process.exit(0);
}

const { layout, issues, added, removed } = buildLayout(
  dataset,
  regenerate ? undefined : await readExistingLayout(),
);
const all = [...issues, ...validateLayout(dataset, layout)];
if (all.length > 0) fail(all);

await writeFile(OUT_PATH, formatLayout(layout));

const kept =
  Object.keys(layout.groups).length + Object.keys(layout.nodes).length -
  added.length;
process.stderr.write(
  `${OUT_PATH}: 천체 ${Object.keys(layout.groups).length}개, ` +
    `노드 ${Object.keys(layout.nodes).length}개 ` +
    `(새로 생성 ${added.length}, 기존 유지 ${kept}, 걷어냄 ${removed.length})\n`,
);
if (removed.length > 0) {
  process.stderr.write(`  걷어낸 좌표: ${removed.join(", ")}\n`);
}
if (regenerate) {
  process.stderr.write("  --regenerate: 수동 보정이 있었다면 diff로 확인할 것\n");
}
