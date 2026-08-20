/**
 * 출처 등록부·페이지 크레딧 링크 생존 점검 (운영 루틴).
 *
 *   pnpm check:links                 리포트를 표준 출력으로
 *   pnpm check:links --out=report.md 리포트를 파일로
 *
 * 등록부에 alive로 적혀 있는데 실제로 죽은 링크가 하나라도 있으면 종료 코드 1로
 * 끝난다 (등록부 갱신이 필요하다는 신호).
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  checkLinks,
  formatReport,
  needsRegistryUpdate,
} from "../src/links/check.ts";
import {
  creditEntries,
  mergeEntries,
  parseRegistry,
} from "../src/links/registry.ts";

const registryPath = "sources/README.md";
const creditsPath = "src/data/sources.json";

const outFlag = process.argv.slice(2).find((arg) => arg.startsWith("--out="));
const outPath = outFlag?.slice("--out=".length);

const [markdown, creditsJson] = await Promise.all([
  readFile(registryPath, "utf8"),
  readFile(creditsPath, "utf8"),
]);
// 등록부(운영 기록) + 페이지 크레딧(유저에게 노출되는 링크) 양쪽을 본다
const entries = mergeEntries(
  parseRegistry(markdown),
  creditEntries(JSON.parse(creditsJson)),
);
process.stderr.write(
  `${registryPath} + ${creditsPath}: ${entries.length}건 점검 중…\n`,
);

const results = await checkLinks(entries);
const report = formatReport(results);

if (outPath === undefined) {
  process.stdout.write(report);
} else {
  await writeFile(outPath, report, "utf8");
  process.stderr.write(`리포트: ${outPath}\n`);
}

process.exitCode = results.some(needsRegistryUpdate) ? 1 : 0;
