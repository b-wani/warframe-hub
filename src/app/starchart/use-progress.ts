"use client";

/**
 * 화면이 완료 집합을 쥐는 자리 (스펙 §4).
 *
 * 완료 집합 하나가 유일한 원본 사실이고, 노드 3상태·행성 완료는 전부 여기서
 * 파생된다 — 그래서 토글 한 번이면 지도 전체(노드 색·연결선·완료 아이콘)가 같은
 * 렌더에서 함께 바뀐다. 파생값을 따로 들고 있지 않으니 어긋날 자리도 없다.
 *
 * 저장은 repository 경계 뒤다 — 이 훅은 로컬스토리지를 모른다(§4.1). 저장소는
 * 첫 렌더에 한 번 정해지고 그 뒤로는 바뀌지 않는다: 진행도의 출처가 화면이
 * 도는 도중에 갈리면 안 된다.
 */
import { useCallback, useState } from "react";
import {
  createLocalStorageProgressRepository,
  type ProgressRepository,
} from "@/starchart/progress-repository";
import { toggleCompletion } from "@/starchart/progress";

export type StarchartProgress = {
  /** 완료 집합 — 토글할 때만 새 객체가 된다. */
  completedIds: ReadonlySet<string>;
  /** 개별 체크(§4.3) — 완료를 뒤집고 곧바로 저장한다. */
  toggle: (id: string) => void;
};

/**
 * 저장된 완료 집합을 읽어 쥐고, 토글을 저장까지 이어 준다.
 *
 * 저장소는 테스트·비브라우저를 위해 주입할 수 있다. 기본값은 로컬스토리지이며,
 * 이 훅은 클라이언트에서만 돈다(스타차트 장면이 `ssr: false`다).
 */
export function useStarchartProgress(
  repository?: ProgressRepository,
): StarchartProgress {
  // 저장소도 완료 집합도 첫 렌더에 한 번만 만든다 — 로컬스토리지는 서버에 없고,
  // 화면이 도는 도중에 진행도의 출처가 갈리면 안 된다.
  const [store] = useState(
    () => repository ?? createLocalStorageProgressRepository(),
  );
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(() =>
    store.load(),
  );

  // 저장은 setState 갱신 함수 밖이다 — StrictMode가 갱신 함수를 두 번 부르므로
  // 그 안에 부수 효과를 두면 저장도 두 번 일어난다.
  const toggle = useCallback(
    (id: string) => {
      const next = toggleCompletion(completedIds, id);
      store.save(next);
      setCompletedIds(next);
    },
    [completedIds, store],
  );

  return { completedIds, toggle };
}
