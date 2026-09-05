"use client";

/**
 * 폴백 뷰 — 3D 없이 진행도를 확인하고 체크하는 화면(스펙 §8).
 *
 * WebGL을 렌더할 수 없는 환경에서 자동으로, 그 밖의 환경에서도 수동 전환으로
 * 열린다. 지도가 하던 일 중 여기서 성립해야 하는 것은 **진행도 확인·체크**다 —
 * 노드가 어떤 상태인지 읽고, 완료를 켜고 끄는 것. 카메라도 좌표도 여기 없다.
 *
 * 구간 일괄 체크도 여기 있다(§4.3) — 행성 전체 완료는 아코디언 안에, 여기까지
 * 완료는 노드 줄마다. 3D 뷰에서만 되는 조작을 남기면 폴백 뷰만 쓰는 사용자에게
 * 영영 닿지 않는 길이 생긴다.
 *
 * 완료 집합은 이 화면의 것이 아니다 — 받아서 읽고, 바꾸는 것은 위로 알린다.
 * 그래서 3D 뷰와 같은 완료 집합·같은 저장소를 쓰고, 어느 쪽에서 체크하든 다른
 * 쪽이 곧바로 같은 상태를 말한다(§4.1).
 *
 * 3상태는 여기서도 파생값이다 — 3D 뷰와 같은 진행도 색인·같은 함수로 계산하므로
 * 두 화면이 다른 답을 낼 자리가 없다(§4.2).
 */
import { useMemo } from "react";
import {
  starchartDataset,
  starchartPlanetGuides,
  starchartProgressGraph,
} from "@/starchart/data";
import { fallbackGroups } from "@/starchart/fallback";
import {
  NODE_STATE_NAME,
  isGroupComplete,
  nodeState,
  type NodeState,
} from "@/starchart/progress";
import { BulkComplete } from "./bulk-complete";
import styles from "./page.module.css";
import { PlanetGuidePanel } from "./planet-guide-panel";

const groups = fallbackGroups(starchartDataset);

export function FallbackView({
  completedIds,
  onToggle,
  onBulkComplete,
}: {
  completedIds: ReadonlySet<string>;
  /** 개별 체크(§4.3) — 3D 뷰의 노드 상세와 같은 조작이다. */
  onToggle: (id: string) => void;
  /** 구간 일괄 체크 확정(§4.3) — 새로 완료되는 id만 올라간다. */
  onBulkComplete: (addedIds: ReadonlySet<string>) => void;
}) {
  return (
    <div className={styles.fallbackList}>
      {groups.map((group) => (
        <FallbackGroupSection
          key={group.id}
          group={group}
          completedIds={completedIds}
          onToggle={onToggle}
          onBulkComplete={onBulkComplete}
        />
      ))}
    </div>
  );
}

function FallbackGroupSection({
  group,
  completedIds,
  onToggle,
  onBulkComplete,
}: {
  group: (typeof groups)[number];
  completedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onBulkComplete: (addedIds: ReadonlySet<string>) => void;
}) {
  // 아코디언이 닫혀 있어도 제목은 완료 개수를 말해야 한다 — 전부 펼쳐 보지 않고도
  // "어디를 더 해야 하는가"를 읽는 것이 이 화면의 쓸모다
  const states = useMemo(
    () =>
      new Map<string, NodeState>(
        group.nodes.map((node) => [
          node.id,
          nodeState(starchartProgressGraph, completedIds, node.id),
        ]),
      ),
    [group, completedIds],
  );
  const done = [...states.values()].filter((state) => state === "cleared").length;
  // 완료 여부는 세어서 판단하지 않는다 — 행성 완료는 3D 뷰의 완료 아이콘과 같은
  // 파생값이고, 두 화면이 다른 규칙으로 답하면 그게 곧 어긋남이다(§4.2)
  const complete = isGroupComplete(starchartProgressGraph, completedIds, group.id);
  // 프록시마는 여기서 독립 항목이지만 가이드는 행성의 것이다 — 조회가 비면 없다
  const guide = starchartPlanetGuides.get(group.id);

  return (
    <details
      className={styles.fallbackGroup}
      data-group-id={group.id}
      data-complete={complete || undefined}
    >
      <summary className={styles.fallbackSummary}>
        <span className={styles.fallbackGroupName}>{group.name}</span>
        <span className={styles.fallbackCount}>
          {done}/{group.nodes.length}
        </span>
        {complete && (
          <span className={styles.focusComplete} role="img" aria-label="완료">
            ✓
          </span>
        )}
      </summary>

      {/*
        행성 가이드도 여기 있다 — 비노드 목표가 3D 뷰에서만 체크된다면 폴백 뷰만
        쓰는 사용자에게 그 목표는 영영 없는 것이 된다(스펙 §8)
      */}
      {guide && (
        <PlanetGuidePanel
          guide={guide}
          completedIds={completedIds}
          onToggle={onToggle}
          className={styles.fallbackGuide}
        />
      )}

      {/*
        행성 전체 완료는 아코디언 안이다 — summary 안에 버튼을 두면 그 클릭이
        아코디언을 여닫는 클릭과 한 자리에서 겹친다
      */}
      <BulkComplete
        target={{ kind: "group", id: group.id }}
        completedIds={completedIds}
        onComplete={onBulkComplete}
        className={styles.fallbackGroupBulk}
      />

      <ul className={styles.fallbackNodes}>
        {group.nodes.map((node) => {
          const state = states.get(node.id) ?? "locked";
          return (
            <li
              key={node.id}
              className={styles.fallbackNode}
              data-node-id={node.id}
              data-state={state}
            >
              {/* 잠긴 노드에도 체크가 열려 있다 — 3D 뷰의 노드 상세와 같은 규칙이다 */}
              <label className={styles.fallbackNodeLabel}>
                <input
                  type="checkbox"
                  checked={state === "cleared"}
                  onChange={() => onToggle(node.id)}
                />
                <span className={styles.fallbackNodeName}>{node.name}</span>
              </label>
              {node.junction && (
                <span className={styles.junctionTag}>교차점</span>
              )}
              <span className={styles.stateTag} data-state={state}>
                {NODE_STATE_NAME[state]}
              </span>
              <BulkComplete
                target={{ kind: "through", id: node.id }}
                completedIds={completedIds}
                onComplete={onBulkComplete}
                className={styles.fallbackNodeBulk}
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
}
