import type { Metadata } from "next";
import { formatPatchBaseline, patchBaseline } from "@/roadmap/patch";
import { getRoadmap } from "@/roadmap/roadmap";
import styles from "./page.module.css";
import { RoadmapTracker } from "./tracker";

export const metadata: Metadata = {
  title: "로드맵",
  description:
    "보어의 전리품부터 두 번째 꿈까지 — 뉴비가 따라갈 메인 퀘스트·교차점 순서와 준비물을 진행 상태로 관리한다.",
};

export default function RoadmapPage() {
  const roadmap = getRoadmap();
  const patches = formatPatchBaseline(patchBaseline(roadmap.nodes));

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>로드맵</h1>
        <p className={styles.patchBaseline}>콘텐츠 기준 패치: {patches}</p>
        <RoadmapTracker roadmap={roadmap} />
      </main>
    </div>
  );
}
