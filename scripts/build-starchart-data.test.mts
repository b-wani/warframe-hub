/**
 * 빌드 스크립트를 실제로 돌려 표시명 오버라이드(#56)를 확인한다 — 표가
 * 스크립트 안에 있으므로 검증도 스크립트 실행으로 한다.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const FIXTURES = "scripts/fixtures";

type Built = { failed: boolean; stderr: string; data?: unknown };

async function build(regions: string, dict = "dict.ko.json"): Promise<Built> {
  const out = join(await mkdtemp(join(tmpdir(), "starchart-")), "starchart.json");
  const args = [
    "scripts/build-starchart-data.mts",
    `--regions=${FIXTURES}/${regions}`,
    `--dict=${FIXTURES}/${dict}`,
    `--dict-en=${FIXTURES}/dict.en.json`,
    `--out=${out}`,
  ];
  try {
    const { stderr } = await run("node", args);
    return { failed: false, stderr, data: JSON.parse(await readFile(out, "utf8")) };
  } catch (error) {
    // 실패 경로는 산출물을 남기지 않는다 — stderr만 돌려준다
    return { failed: true, stderr: String((error as { stderr?: string }).stderr ?? error) };
  }
}

type Dataset = { groups: Record<string, { name: string }> };

describe("표시명 오버라이드", () => {
  it("업스트림 사전이 틀린 그룹 이름을 인게임 표기로 덮는다", async () => {
    const result = await build("regions-tau.json");
    expect(result.stderr).not.toContain("✗");
    const { groups } = result.data as Dataset;
    expect(groups.TauRegion.name).toBe("타우");
    // 같은 사전의 정상 키는 그대로 통과한다
    expect(groups.EarthName.name).toBe("지구");
  });

  it("쓰이지 않는 오버라이드 항목이 있으면 빌드가 실패한다", async () => {
    const result = await build("regions-no-tau.json");
    expect(result.failed).toBe(true);
    expect(result.stderr).toContain("쓰이지 않는 표시명 오버라이드");
  });

  it("사전이 고쳐져 오버라이드와 같아지면 빌드가 실패한다", async () => {
    const result = await build("regions-tau.json", "dict.ko-tau-fixed.json");
    expect(result.failed).toBe(true);
    expect(result.stderr).toContain("사전이 고쳐진 표시명 오버라이드");
  });
});
