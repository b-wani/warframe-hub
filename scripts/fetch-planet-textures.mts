/**
 * 천체 텍스처 받아오기 (수동 실행 + 커밋).
 *
 *   pnpm fetch:textures          없는 것만 내려받는다
 *   pnpm fetch:textures --force  이미 있는 것도 다시 내려받는다
 *   pnpm fetch:textures --check  내려받지 않고 빠진 파일만 알려준다
 *
 * 받는 대상은 텍스처 카탈로그(src/starchart/textures.ts) 하나뿐이다 — 화면이
 * 쓰는 목록과 내려받는 목록이 갈라질 자리를 두지 않는다.
 *
 * 받은 파일은 public/textures/planets/에 커밋한다. 배포본이 외부 사이트의 생존에
 * 매달리지 않게 하려는 것이고, CC BY 4.0이 재배포를 허용한다 — 조건인 출처 표기는
 * 스타차트 페이지에서 한다(수용 기준 §10-7).
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import {
  TEXTURE_DIR,
  TEXTURE_FILES,
  textureSourceUrl,
  type TextureFile,
} from "../src/starchart/textures.ts";

const OUT_DIR = `public/${TEXTURE_DIR}`;

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const force = flags.has("--force");
const checkOnly = flags.has("--check");

const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;

async function sizeOf(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).size;
  } catch {
    return undefined;
  }
}

async function download(file: TextureFile, path: string): Promise<number> {
  const url = textureSourceUrl(file);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  // 원본이 사라졌거나 오류 페이지가 왔을 때 HTML을 텍스처로 커밋하지 않게 막는다
  if (body.byteLength < 1024) {
    throw new Error(`${url}: 내용이 너무 작다 (${body.byteLength} 바이트)`);
  }
  await writeFile(path, body);
  return body.byteLength;
}

if (!checkOnly) await mkdir(OUT_DIR, { recursive: true });

const missing: string[] = [];
const failures: string[] = [];
let fetched = 0;
let kept = 0;
let total = 0;

for (const file of TEXTURE_FILES) {
  const path = `${OUT_DIR}/${file}`;
  const existing = await sizeOf(path);

  if (checkOnly) {
    if (existing === undefined) missing.push(file);
    else total += existing;
    continue;
  }
  if (existing !== undefined && !force) {
    kept++;
    total += existing;
    continue;
  }
  try {
    const size = await download(file, path);
    fetched++;
    total += size;
    process.stderr.write(`↓ ${file} (${kb(size)})\n`);
  } catch (error) {
    failures.push(`${file}: ${error instanceof Error ? error.message : error}`);
  }
}

if (checkOnly) {
  if (missing.length > 0) {
    process.stderr.write(
      `${OUT_DIR}: 빠진 텍스처 ${missing.length}개 — pnpm fetch:textures\n` +
        missing.map((f) => `  ✗ ${f}\n`).join(""),
    );
    process.exit(1);
  }
  process.stderr.write(
    `${OUT_DIR}: 텍스처 ${TEXTURE_FILES.length}개 전부 있다 (${kb(total)})\n`,
  );
  process.exit(0);
}

if (failures.length > 0) {
  process.stderr.write(failures.map((f) => `✗ ${f}\n`).join(""));
  process.exit(1);
}

process.stderr.write(
  `${OUT_DIR}: 텍스처 ${TEXTURE_FILES.length}개 (새로 받음 ${fetched}, ` +
    `기존 유지 ${kept}, 합계 ${kb(total)})\n`,
);
