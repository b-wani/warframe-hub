/**
 * 프록시마의 종속 관계 — 행성 뷰의 ⚓ 토글이 읽는 것(스펙 §2.1).
 *
 * 프록시마(레일잭 궤도 구역 7)는 독립 천체가 아니다. 성계 뷰에는 없고, 해당
 * 행성의 행성 뷰에서 ⚓ 토글로 전환하면 그 행성 **바깥 고리**에 노드가 뜬다.
 * 어느 프록시마가 어느 행성에 붙는지는 천체 배치표(`celestial.ts`)가 이미
 * 알고 있으므로 여기서 다시 정하지 않는다 — 그 표의 `host`를 뒤집어 읽는다.
 *
 * 고리의 자리도 좌표 데이터셋이 정한다. 프록시마 그룹은 천체가 아니어도 좌표를
 * 갖고(그래서 `isPlacedGroup`과 `isCelestialBodyGroup`이 갈린다), 그 좌표는
 * 자기 행성에서 태양 반대쪽으로 밀려난 바깥 고리 위의 점이다. 노드 배치는
 * 노드 구름과 같은 규칙(배율 하나 + 평행이동 하나)이라, 배치를 손보는 자리는
 * 여기서도 좌표 데이터셋 하나다(CONTEXT "노드 구름").
 *
 * 베일 프록시마(`DeepSpace_SPACE`)만 host가 없다 — 인게임에서도 특정 행성에
 * 붙지 않는 심우주 구역이라 붙일 행성이 없다. 3D 지도에는 자리가 없고 폴백 뷰의
 * 독립 항목으로만 닿는다.
 *
 * 진행도의 집계도 이 종속 관계를 따른다: 성계 뷰의 완료 아이콘은 그 **천체**에
 * 매달린 것 전부를 말해야 하므로, 행성 자신의 노드와 종속 프록시마의 노드가
 * 함께 채워졌을 때만 완료다(스펙 §4.2).
 */
import { WORLD_SCALE, type SolarSystemBody } from "./bodies.ts";
import { CELESTIAL_BODIES } from "./celestial.ts";
import type { StarchartDataset } from "./dataset.ts";
import type { StarchartLayout } from "./layout.ts";
import { nodeCloud, type NodeCloud } from "./node-cloud.ts";
import { isGroupComplete, type StarchartProgressGraph } from "./progress.ts";

/** 행성 id → 그 행성에 종속된 프록시마 그룹 id. 천체 배치표를 뒤집은 것이다. */
const HOST_TO_PROXIMA = new Map<string, string[]>();
for (const body of CELESTIAL_BODIES) {
  if (body.kind !== "proxima") continue;
  const hosted = HOST_TO_PROXIMA.get(body.host);
  if (hosted) hosted.push(body.id);
  else HOST_TO_PROXIMA.set(body.host, [body.id]);
}

/** 한 행성 뷰의 ⚓ 토글이 보여줄 프록시마 고리 하나. */
export type ProximaRing = {
  /** 프록시마 그룹 id — 완료 파생·일괄 체크의 대상이다. */
  group: string;
  /** 그룹 표시명("지구 프록시마") — HUD가 어디에 와 있는지 말한다. */
  name: string;
  /** 이 고리가 매달린 행성. */
  host: string;
  /** 노드 구름과 같은 표시 모델 — 화면은 두 원반을 구별해 그리지 않는다. */
  cloud: NodeCloud;
};

/** 이 행성에 종속된 프록시마 그룹 id. 없으면 빈 배열이다. */
export function proximaGroupsOf(bodyId: string): readonly string[] {
  return HOST_TO_PROXIMA.get(bodyId) ?? [];
}

/**
 * 천체 하나에 매달린 진행도 그룹 — 행성 자신과 종속 프록시마. 성계 뷰의 완료
 * 아이콘이 무엇을 세는지가 이 목록이다.
 */
export function bodyGroups(bodyId: string): string[] {
  return [bodyId, ...proximaGroupsOf(bodyId)];
}

/**
 * 천체 완료 여부 — 파생값이다(스펙 §4.2). 행성 뷰에서 ⚓ 토글로 닿는 프록시마
 * 노드까지 전부 완료됐을 때만 참이다. 그룹 하나만 보는 `isGroupComplete`와
 * 주체가 다르다: 저쪽은 그룹(폴백 뷰의 한 항목), 이쪽은 천체(지도의 한 행성)다.
 */
export function isBodyComplete(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
  bodyId: string,
): boolean {
  return bodyGroups(bodyId).every((groupId) =>
    isGroupComplete(graph, completedIds, groupId),
  );
}

/**
 * 행성마다 프록시마 고리를 계산한다. 좌표가 빠진 그룹·노드는 그리지 않고
 * `issues`로 알린다 — 게임 패치로 프록시마가 늘면 화면이 조용히 빠뜨리는 대신
 * CI에서 드러나야 한다.
 *
 * 결과의 키는 **행성 id**다. 행성 뷰가 "지금 이 행성에 프록시마가 있는가"를
 * 묻는 자리이므로, ⚓ 토글의 노출 조건이 곧 이 지도의 조회 하나가 된다.
 */
export function proximaRings(
  dataset: StarchartDataset,
  layout: StarchartLayout,
  bodies: SolarSystemBody[],
): { rings: Map<string, ProximaRing>; issues: string[] } {
  const rings = new Map<string, ProximaRing>();
  const issues: string[] = [];

  for (const body of bodies) {
    for (const group of proximaGroupsOf(body.id)) {
      if (rings.has(body.id)) {
        // ⚓ 토글은 행성마다 고리 하나를 전제한다 — 둘이 되면 무엇을 보여줄지
        // 정하는 결정이 필요하므로 조용히 하나를 버리지 않는다
        issues.push(
          `행성 "${body.id}"에 프록시마 그룹이 둘 이상이다 (⚓ 토글은 하나만 보여준다)`,
        );
        continue;
      }
      const point = layout.groups[group];
      const host = layout.groups[body.id];
      if (!point || !host) {
        issues.push(
          `프록시마 "${group}"의 좌표가 없다 (좌표 데이터셋을 다시 생성해야 한다)`,
        );
        continue;
      }
      // 행성에서 얼마나 비켜 있는지를 좌표 데이터셋에서 그대로 읽는다 — 행성을
      // 옮기면 고리도 함께 따라간다
      const built = nodeCloud(dataset, layout, {
        body,
        group,
        offset: [
          (point.x - host.x) * WORLD_SCALE,
          (point.y - host.y) * WORLD_SCALE,
        ],
      });
      issues.push(...built.issues);
      rings.set(body.id, {
        group,
        name: dataset.groups[group].name,
        host: body.id,
        cloud: built.cloud,
      });
    }
  }

  return { rings, issues };
}
