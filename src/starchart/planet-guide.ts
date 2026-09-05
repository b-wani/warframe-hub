/**
 * 행성 가이드의 **그릇** — 스키마와 로드 경로(스펙 §2.1·§4.3, CONTEXT "행성 가이드").
 *
 * 행성 뷰가 함께 노출하는 초보자 안내("이 행성에서 무엇을 해야 하는가")와, 그
 * 안의 **비노드 목표** 체크 항목이 여기서 온다. 가이드 본문 저작은 스펙 이후
 * 단계이며 이 모듈의 몫이 아니다(§9) — 여기는 무엇이 어떤 모양으로 들어오고
 * 무엇이 잘못됐는지 알리는 자리다.
 *
 * 자동 생성물(정제 노드 데이터셋)과 분리된 수동 저작 JSON이다 — 재생성이
 * 저작을 덮어쓸 자리를 만들지 않으려는 것이며, 큐레이션 오버레이(§3.3)와 같은
 * 이유다.
 *
 * 비노드 목표는 성계 노드로 환원되지 않는 완료 대상뿐이다. 교차점은 여기 속하지
 * 않는다 — 정제 노드 데이터셋의 실제 노드이므로 노드 완료로만 추적한다
 * (CONTEXT "비노드 목표"). 슬러그가 데이터셋의 노드 id와 겹치면 그 순간 두
 * 화면이 같은 id를 서로 다른 것으로 부르게 되므로, 겹침은 문제로 알린다.
 *
 * 던지지 않는다 — 문제는 `issues`로 모아 CI 단위 테스트가 잡는다(`bodies.ts`와
 * 같은 규약). 잘못된 가이드 하나가 화면 전체를 떨어뜨리지 않는다.
 */
import { z } from "zod";
import { isCelestialBodyGroup, type StarchartDataset } from "./dataset.ts";

/** 비노드 목표의 종류 — 퀘스트이거나 준비 목표다(CONTEXT "비노드 목표"). */
export type NonNodeObjectiveKind = "quest" | "preparation";

const objectiveSchema = z.strictObject({
  /** 완료 집합에 기록되는 id. 성계 노드 id와 같은 집합에 산다(§4.1). */
  slug: z.string().min(1),
  kind: z.enum(["quest", "preparation"]),
  title: z.string().min(1),
  /** 한 줄 부연. 없으면 화면에도 없다 — 빈칸을 지어내지 않는다. */
  note: z.string().min(1).optional(),
});

const guideSchema = z.strictObject({
  /** 이 가이드가 붙는 천체(그룹) id. */
  body: z.string().min(1),
  /**
   * "이 행성에서 무엇을 해야 하는가" 본문. 저작은 스펙 이후 단계라(§9) 아직
   * 비어 있을 수 있고, 그때 화면은 준비 중임을 알린다.
   */
  summary: z.string().min(1).optional(),
  objectives: z.array(objectiveSchema),
});

const guideFileSchema = z.strictObject({
  /** 이 파일 전체가 어느 게임 업데이트를 기준으로 확인된 것인가. */
  basedOnPatch: z.string().min(1),
  guides: z.array(guideSchema),
});

export type NonNodeObjective = z.infer<typeof objectiveSchema>;
export type PlanetGuide = z.infer<typeof guideSchema> & {
  /** 파일 전체의 기준 패치를 가이드마다 펴 둔 것 — 화면이 파일을 몰라도 된다. */
  basedOnPatch: string;
};

/**
 * 저작 JSON을 화면이 읽는 모양으로 옮긴다. 천체 id로 찾을 수 있어야 하므로
 * Map이다 — 행성 뷰도 폴백 뷰도 "지금 이 천체의 가이드"만 묻는다.
 *
 * 문제가 있는 것은 결과에서 빠지고 `issues`에 남는다. 빠지는 단위는 문제의
 * 단위다: 스키마 위반은 파일 전체, 성계 뷰에 없는 천체·천체 중복은 가이드
 * 하나, 노드 id와 겹치는 슬러그·슬러그 중복은 그 목표 하나다. 잘못된 목표
 * 하나 때문에 그 행성의 나머지 안내까지 사라질 이유는 없다.
 *
 * 겹치는 슬러그를 굳이 걸러 내는 것은 그것이 화면에 서면 체크 한 번이 성계
 * 노드를 완료 집합에 밀어 넣기 때문이다 — 같은 id를 두 화면이 서로 다른
 * 것으로 부르게 된다(CONTEXT "비노드 목표").
 */
export function planetGuides(
  dataset: StarchartDataset,
  raw: unknown,
): { guides: Map<string, PlanetGuide>; issues: string[] } {
  const guides = new Map<string, PlanetGuide>();
  const issues: string[] = [];

  const file = guideFileSchema.safeParse(raw);
  if (!file.success) {
    return {
      guides,
      issues: [`행성 가이드 파일의 모양이 스키마와 다르다: ${file.error.message}`],
    };
  }

  const seenSlugs = new Set<string>();
  for (const guide of file.data.guides) {
    const group = dataset.groups[guide.body];
    if (!group || !isCelestialBodyGroup(group)) {
      issues.push(
        `행성 가이드가 성계 뷰에 없는 천체 "${guide.body}"에 붙어 있다 (닿을 화면이 없다)`,
      );
      continue;
    }
    if (guides.has(guide.body)) {
      issues.push(`천체 "${guide.body}"의 행성 가이드가 둘 이상이다`);
      continue;
    }

    const objectives: NonNodeObjective[] = [];
    for (const objective of guide.objectives) {
      if (dataset.nodes[objective.slug]) {
        issues.push(
          `비노드 목표 "${objective.slug}"가 성계 노드 id와 겹친다 (노드는 노드 완료로만 추적한다)`,
        );
        continue;
      }
      if (seenSlugs.has(objective.slug)) {
        issues.push(`비노드 목표 슬러그 "${objective.slug}"가 두 번 쓰였다`);
        continue;
      }
      seenSlugs.add(objective.slug);
      objectives.push(objective);
    }

    guides.set(guide.body, {
      ...guide,
      objectives,
      basedOnPatch: file.data.basedOnPatch,
    });
  }

  return { guides, issues };
}

