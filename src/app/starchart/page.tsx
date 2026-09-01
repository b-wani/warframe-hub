import type { Metadata } from "next";
import styles from "./page.module.css";
import { StarchartClient } from "./starchart-client";
import { TextureCredit } from "./texture-credit";

export const metadata: Metadata = {
  title: "스타차트",
  description:
    "워프레임 성계지도를 3D로 재현한 진행도 화면. 행성과 노드를 게임처럼 둘러보며 어디까지 했는지 확인한다.",
  openGraph: { url: "/starchart", title: "스타차트" },
};

export default function StarchartPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>스타차트</h1>
      </header>
      <StarchartClient />
      <footer className={styles.footer}>
        <TextureCredit />
      </footer>
    </div>
  );
}
