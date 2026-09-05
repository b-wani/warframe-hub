/**
 * 콘텐츠 기준 패치 표기 — 이 페이지가 노출하는 큐레이션 콘텐츠가 어느 게임
 * 업데이트를 기준으로 확인된 것인가(CONTEXT "콘텐츠 기준 패치", 스펙 §3.3).
 *
 * 값은 오버레이의 노드별 기준 패치를 중복 없이 모은 것이다(`patchBaseline`).
 * 보통 하나이며, 여럿이 나오면 그대로 여럿을 적는다 — 콘텐츠가 서로 다른 패치를
 * 기준으로 섞여 있다는 사실을 하나로 뭉개 감추지 않는다.
 *
 * 실린 콘텐츠가 없으면 아무것도 그리지 않는다. "알 수 없음"은 확인해 봤더니
 * 모른다는 말이지만, 여기서는 기준을 물을 콘텐츠 자체가 없다.
 */
import styles from "./page.module.css";

export function PatchBaseline({ patches }: { patches: readonly string[] }) {
  if (patches.length === 0) return null;
  return <p className={styles.credit}>콘텐츠 기준 패치 {patches.join(", ")}</p>;
}
