/**
 * 스타차트가 아직 오지 않았을 때의 한 줄.
 *
 * 이 문구가 걸리는 자리는 둘이고 이유가 같다 — `ssr: false` 경계(`starchart-client`)와
 * three 번들 경계(`starchart-view`의 `Scene`). 서버가 보내는 첫 HTML도 이것이라
 * 문구가 갈리면 화면이 두 번 바뀐 것처럼 읽힌다.
 */
import styles from "./page.module.css";

export function StarchartLoading() {
  return <p className={styles.loading}>성계지도를 불러오는 중…</p>;
}
