/**
 * 큐레이션 오버레이의 **그릇** — 스키마와 로드 경로(스펙 §3.3, CONTEXT
 * "큐레이션 오버레이").
 *
 * 주요 노드(교차점·보스)는 구조화 데이터만으로는 가치가 드러나지 않는다 —
 * "여기서 무엇을 얻고 무엇을 조심하는가"는 사람이 써야 나온다. 그 수동 저작
 * 콘텐츠가 노드 상세에 얹히는 경로가 여기다. 32노드 본문 저작은 스펙 이후
 * 단계이며 이 모듈의 몫이 아니다(§9) — 여기는 무엇이 어떤 모양으로 들어오고
 * 무엇이 잘못됐는지 알리는 자리다.
 *
 * 자동 생성물(정제 노드 데이터셋)과 분리된 노드 id 키 JSON이다 — 재생성이
 * 저작을 덮어쓸 자리를 만들지 않으려는 것이며, 행성 가이드(`planet-guide.ts`)와
 * 같은 이유·같은 규약이다.
 *
 * 기준 패치는 파일이 아니라 노드마다 있다. 32노드는 한 번에 쓰이지 않고 한
 * 건씩 늘어나므로, 파일 하나에 패치 하나를 적으면 새 저작 하나가 옛 저작
 * 전부의 확인 시점까지 갱신했다고 말하게 된다 — 노후화 판별의 축이 무너진다
 * (CONTEXT "기준 패치"). 페이지 표기는 그것들을 모은 값이다(`patchBaseline`).
 *
 * 던지지 않는다 — 문제는 `issues`로 모아 CI 단위 테스트가 잡는다
 * (`planet-guide.ts`와 같은 규약). 잘못된 오버레이 하나가 화면 전체를
 * 떨어뜨리지 않는다.
 */
import { z } from "zod";
import { isBossNode, isJunction, type StarchartDataset } from "./dataset.ts";

const preparationSchema = z.strictObject({
  name: z.string().min(1),
  /** 어디서 얻는가. 준비물은 이름만 알아서는 준비할 수 없다. */
  source: z.string().min(1),
  quantity: z.number().int().positive(),
});

const overlaySchema = z.strictObject({
  /** 이 노드가 무엇이고 왜 중요한가. 오버레이의 최소 단위다. */
  summary: z.string().min(1),
  preparations: z.array(preparationSchema).default([]),
  cautions: z.array(z.string().min(1)).default([]),
  /** 본편 이야기를 미리 말하는 콘텐츠인가. 화면이 가릴지 정하는 근거다. */
  spoiler: z.boolean().default(false),
  /**
   * 재서술의 근거가 된 출처. 최소 하나 — 출처 없는 저작은 싣지 않는다
   * (CONTEXT "지식 베이스").
   */
  sourceIds: z.array(z.string().min(1)).min(1),
  /** 이 콘텐츠가 유효하다고 확인된 게임 업데이트(CONTEXT "기준 패치"). */
  basedOnPatch: z.string().min(1),
  /** 보스 노드의 대표 드랍. 보스가 아닌 노드에는 있을 수 없다. */
  drops: z.array(z.string().min(1)).min(1).optional(),
});

/** 노드 id를 키로 하는 저작 파일 전체. */
const overlayFileSchema = z.record(z.string().min(1), overlaySchema);

export type CurationPreparation = z.infer<typeof preparationSchema>;
export type NodeOverlay = z.infer<typeof overlaySchema>;

/**
 * 큐레이션 대상인 **주요 노드**의 id — 교차점과 보스 노드다(CONTEXT "주요 노드").
 *
 * 목록을 따로 적지 않고 데이터셋에서 파생한다. 손으로 적은 32개짜리 목록은
 * 게임 패치로 노드가 늘거나 줄 때 조용히 어긋나고, 그 어긋남은 "왜 이 노드엔
 * 오버레이를 못 붙이지"라는 모양으로만 드러난다.
 *
 * 릴레이 그룹은 지도에서 숨기고 진행도와도 무관하므로(#26) 대상이 아니다 —
 * 닿을 화면이 없는 노드에 콘텐츠를 붙일 자리를 만들지 않는다.
 */
export function majorNodeIds(dataset: StarchartDataset): Set<string> {
  const ids = new Set<string>();
  for (const [id, node] of Object.entries(dataset.nodes)) {
    if (dataset.groups[node.group]?.type === "relay") continue;
    if (isJunction(node) || isBossNode(node)) ids.add(id);
  }
  return ids;
}

/**
 * 저작 JSON을 화면이 읽는 모양으로 옮긴다. 노드 id로 찾을 수 있어야 하므로
 * Map이다 — 노드 상세는 "지금 이 노드의 오버레이"만 묻는다.
 *
 * 문제가 있는 것은 결과에서 빠지고 `issues`에 남는다. 빠지는 단위는 문제의
 * 단위다: 스키마 위반은 파일 전체, 데이터셋에 없는 노드·주요 노드가 아닌
 * 노드는 그 오버레이 하나, 보스가 아닌 노드의 드랍은 그 필드 하나다. 잘못
 * 붙은 드랍 한 줄 때문에 그 노드의 안내까지 사라질 이유는 없다.
 */
export function nodeOverlays(
  dataset: StarchartDataset,
  raw: unknown,
): { overlays: Map<string, NodeOverlay>; issues: string[] } {
  const overlays = new Map<string, NodeOverlay>();
  const issues: string[] = [];

  const file = overlayFileSchema.safeParse(raw);
  if (!file.success) {
    return {
      overlays,
      issues: [
        `큐레이션 오버레이 파일의 모양이 스키마와 다르다: ${file.error.message}`,
      ],
    };
  }

  const major = majorNodeIds(dataset);
  for (const [id, overlay] of Object.entries(file.data)) {
    const node = dataset.nodes[id];
    if (!node) {
      issues.push(
        `큐레이션 오버레이가 정제 노드 데이터셋에 없는 노드 "${id}"에 붙어 있다 (얹을 노드가 없다)`,
      );
      continue;
    }
    if (!major.has(id)) {
      issues.push(
        `큐레이션 오버레이가 주요 노드가 아닌 "${id}"에 붙어 있다 (대상은 교차점과 보스 노드다)`,
      );
      continue;
    }
    if (overlay.drops && !isBossNode(node)) {
      issues.push(
        `보스 노드가 아닌 "${id}"에 대표 드랍이 적혀 있다 (드랍은 보스 노드의 것이다)`,
      );
      overlays.set(id, { ...overlay, drops: undefined });
      continue;
    }

    overlays.set(id, overlay);
  }

  return { overlays, issues };
}

/**
 * **콘텐츠 기준 패치** — 실린 오버레이의 기준 패치를 중복 없이 모은 것
 * (CONTEXT "콘텐츠 기준 패치"). 보통 하나이며, 여럿이 나오면 콘텐츠가 서로
 * 다른 패치를 기준으로 섞여 있다는 뜻이다. 실린 것이 없으면 표기할 것도 없다.
 */
export function patchBaseline(
  overlays: ReadonlyMap<string, NodeOverlay>,
): string[] {
  return [...new Set([...overlays.values()].map((o) => o.basedOnPatch))];
}
