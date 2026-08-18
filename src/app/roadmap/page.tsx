import type { Metadata } from "next";
import { getRoadmap } from "@/roadmap/roadmap";
import type { NodeKind } from "@/roadmap/schema";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "로드맵 — 워프레임 허브",
  description: "한국 워프레임 뉴비를 위한 진행 로드맵",
};

const kindLabels: Record<NodeKind, string> = {
  quest: "퀘스트",
  junction: "교차점",
  preparation: "준비 목표",
};

export default function RoadmapPage() {
  const { nodes, sources } = getRoadmap();
  const sourcesById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>로드맵</h1>
        <ol className={styles.nodeList} aria-label="로드맵">
          {nodes.map((node) => (
            <li key={node.id} className={styles.node}>
              <span className={styles.kind}>{kindLabels[node.kind]}</span>
              <h2>{node.title}</h2>
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
      </main>
    </div>
  );
}
