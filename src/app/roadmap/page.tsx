import type { Metadata } from "next";
import { getRoadmap } from "@/roadmap/roadmap";
import styles from "./page.module.css";
import { RoadmapTracker } from "./tracker";

export const metadata: Metadata = {
  title: "로드맵 — 워프레임 허브",
  description: "한국 워프레임 뉴비를 위한 진행 로드맵",
};

export default function RoadmapPage() {
  const roadmap = getRoadmap();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>로드맵</h1>
        <RoadmapTracker roadmap={roadmap} />
      </main>
    </div>
  );
}
