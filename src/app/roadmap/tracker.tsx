"use client";

import { useEffect, useRef, useState } from "react";
import {
  completeThrough,
  computeProgress,
  resetProgress,
  toggleNode,
} from "@/progress/engine";
import { useProgress } from "@/progress/use-progress";
import type { NodeKind, Roadmap, RoadmapNode } from "@/roadmap/schema";
import styles from "./page.module.css";
import { ContextWidget } from "./widget";

const kindLabels: Record<NodeKind, string> = {
  quest: "퀘스트",
  junction: "교차점",
  preparation: "준비 목표",
};

const maskedTitle = "??? (스포일러)";

export function RoadmapTracker({ roadmap }: { roadmap: Roadmap }) {
  const { nodes, sources } = roadmap;
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const [completedIds, setCompletedIds] = useProgress();
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  // 일괄 완료는 실수 방지를 위해 확인 단계를 거친다. 확인을 띄운 시점의 진행
  // 상태(baseline)를 함께 들고 있다가, 그 사이 진행이 바뀌면 확인을 무효화한다
  // — 유저가 읽은 개수와 실제로 반영되는 집합이 어긋나면 안 되기 때문이다.
  const [confirming, setConfirming] = useState<{
    nodeId: string;
    baseline: ReadonlySet<string>;
  } | null>(null);
  const confirmingId =
    confirming !== null && confirming.baseline === completedIds
      ? confirming.nodeId
      : null;

  const isMasked = (node: RoadmapNode) =>
    node.spoiler && !revealedIds.has(node.id);
  const displayTitle = (node: RoadmapNode) =>
    isMasked(node) ? maskedTitle : node.title;
  const reveal = (id: string) =>
    setRevealedIds((prev) => new Set(prev).add(id));

  const progress = computeProgress(nodes, completedIds);
  const percent = Math.round(progress.completionRate * 100);

  return (
    <>
      <section className={styles.summary} aria-label="진행 요약">
        <p>
          완료율 {percent}% ({progress.completedCount}/{progress.totalCount})
        </p>
        <button type="button" onClick={() => setCompletedIds(resetProgress())}>
          진행 초기화
        </button>
      </section>

      <ContextWidget
        nextGoals={progress.nextGoals.filter((node) => !isMasked(node))}
      />

      <section aria-label="다음 목표">
        <h2>다음 목표</h2>
        {progress.nextGoals.length > 0 ? (
          <ul className={styles.nextGoals}>
            {progress.nextGoals.map((node) => (
              <li key={node.id}>{displayTitle(node)}</li>
            ))}
          </ul>
        ) : (
          <p>남은 목표가 없다. 로드맵을 전부 완료했다!</p>
        )}
      </section>

      <ol className={styles.nodeList} aria-label="로드맵">
        {nodes.map((node, index) => (
          <li key={node.id} className={styles.node}>
            <span className={styles.kind}>{kindLabels[node.kind]}</span>
            <h2>{displayTitle(node)}</h2>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={completedIds.has(node.id)}
                onChange={() =>
                  setCompletedIds(toggleNode(completedIds, node.id))
                }
                // 가림 상태에서는 제목 대신 순번으로 접근성 이름을 유일하게 만든다
                // (id는 퀘스트 이름이라 스포일러가 샌다)
                aria-label={
                  isMasked(node)
                    ? `${index + 1}번째 노드 (스포일러) 완료`
                    : `${node.title} 완료`
                }
              />
              완료
            </label>
            <BulkComplete
              nodes={nodes}
              completedIds={completedIds}
              nodeId={node.id}
              index={index}
              title={node.title}
              masked={isMasked(node)}
              confirming={confirmingId === node.id}
              onRequest={() =>
                setConfirming({ nodeId: node.id, baseline: completedIds })
              }
              onCancel={() => setConfirming(null)}
              onConfirm={(next) => {
                setCompletedIds(next);
                setConfirming(null);
              }}
            />
            {isMasked(node) ? (
              <div className={styles.spoilerGate}>
                <p>스포일러 방지를 위해 제목과 내용이 가려져 있다.</p>
                <button type="button" onClick={() => reveal(node.id)}>
                  스포일러 공개
                </button>
              </div>
            ) : (
              <>
                <p>{node.summary}</p>
                <details className={styles.detail}>
                  <summary>상세 보기</summary>
                  {node.prerequisites.length > 0 && (
                    <section aria-label="선행조건">
                      <h3>선행조건</h3>
                      <ul>
                        {node.prerequisites.map((prereqId) => {
                          // 참조 무결성은 loadRoadmap이 보장한다
                          const prereq = nodesById.get(prereqId)!;
                          return (
                            <li key={prereqId}>
                              {displayTitle(prereq)}
                              {completedIds.has(prereqId) && " — 완료"}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                  {node.preparations.length > 0 && (
                    <section aria-label="준비물">
                      <h3>준비물</h3>
                      <ul>
                        {node.preparations.map((prep) => (
                          <li key={prep.name}>
                            {prep.name} ×{prep.quantity} — {prep.source}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {node.cautions.length > 0 && (
                    <section aria-label="주의사항">
                      <h3>주의사항</h3>
                      <ul>
                        {node.cautions.map((caution) => (
                          <li key={caution}>{caution}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <p className={styles.meta}>
                    기준 패치: {node.basedOnPatch} · 출처:{" "}
                    {node.sourceIds.map((sourceId, index) => {
                      // 출처 참조 무결성은 loadRoadmap이 보장한다
                      const source = sourcesById.get(sourceId)!;
                      return (
                        <span key={sourceId}>
                          {index > 0 && ", "}
                          <a href={source.url} rel="noreferrer noopener">
                            {source.title}
                          </a>
                        </span>
                      );
                    })}
                  </p>
                </details>
              </>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * "여기까지 완료" 버튼과 실수 방지용 확인 단계.
 * 이 노드까지의 선행 전체가 이미 완료라면 아무것도 그리지 않는다.
 */
function BulkComplete({
  nodes,
  completedIds,
  nodeId,
  index,
  title,
  masked,
  confirming,
  onRequest,
  onCancel,
  onConfirm,
}: {
  nodes: RoadmapNode[];
  completedIds: ReadonlySet<string>;
  nodeId: string;
  index: number;
  title: string;
  masked: boolean;
  confirming: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: (next: ReadonlySet<string>) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // 확인 단계가 열리면 포커스를 옮긴다 (스크린리더가 변경을 놓치지 않도록)
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const planned = completeThrough(nodes, completedIds, nodeId);
  const pendingCount = planned.size - completedIds.size;
  if (pendingCount === 0) {
    return null;
  }

  // 체크박스와 같은 규칙으로 접근성 이름을 노드마다 유일하게 만든다
  // (가림 상태에서는 제목 대신 순번을 쓴다)
  const label = masked
    ? `${index + 1}번째 노드 (스포일러)까지 일괄 완료`
    : `${title}까지 일괄 완료`;

  if (!confirming) {
    return (
      <button
        type="button"
        className={styles.bulkButton}
        aria-label={label}
        onClick={onRequest}
      >
        여기까지 완료
      </button>
    );
  }

  return (
    <section
      className={styles.bulkConfirm}
      aria-label="일괄 완료 확인"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <p>선행 노드를 포함해 {pendingCount}개 노드가 완료 처리된다. 계속할까?</p>
      <button ref={confirmRef} type="button" onClick={() => onConfirm(planned)}>
        일괄 완료
      </button>
      <button type="button" onClick={onCancel}>
        취소
      </button>
    </section>
  );
}
