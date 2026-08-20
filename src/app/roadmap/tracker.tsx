"use client";

import { useState } from "react";
import { computeProgress, resetProgress, toggleNode } from "@/progress/engine";
import { useProgress } from "@/progress/use-progress";
import type { NodeKind, Roadmap, RoadmapNode } from "@/roadmap/schema";
import styles from "./page.module.css";

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
