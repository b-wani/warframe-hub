"use client";

import { computeProgress, resetProgress, toggleNode } from "@/progress/engine";
import { useProgress } from "@/progress/use-progress";
import type { NodeKind, Roadmap } from "@/roadmap/schema";
import styles from "./page.module.css";

const kindLabels: Record<NodeKind, string> = {
  quest: "퀘스트",
  junction: "교차점",
  preparation: "준비 목표",
};

export function RoadmapTracker({ roadmap }: { roadmap: Roadmap }) {
  const { nodes, sources } = roadmap;
  const sourcesById = new Map(sources.map((s) => [s.id, s]));

  const [completedIds, setCompletedIds] = useProgress();

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
              <li key={node.id}>{node.title}</li>
            ))}
          </ul>
        ) : (
          <p>남은 목표가 없다. 로드맵을 전부 완료했다!</p>
        )}
      </section>

      <ol className={styles.nodeList} aria-label="로드맵">
        {nodes.map((node) => (
          <li key={node.id} className={styles.node}>
            <span className={styles.kind}>{kindLabels[node.kind]}</span>
            <h2>{node.title}</h2>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={completedIds.has(node.id)}
                onChange={() =>
                  setCompletedIds(toggleNode(completedIds, node.id))
                }
                aria-label={`${node.title} 완료`}
              />
              완료
            </label>
            <p>{node.summary}</p>
            {node.preparations.length > 0 && (
              <section>
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
              <section>
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
          </li>
        ))}
      </ol>
    </>
  );
}
