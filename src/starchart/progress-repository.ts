/**
 * 완료 집합의 저장 경계 (스펙 §4.1).
 *
 * 도메인은 이 인터페이스만 알고, 뒤에 로컬스토리지가 있는지 서버가 있는지는
 * 모른다 — 이후 계정 기반 서버 저장으로 갈아탈 자리다(§9).
 *
 * 스키마는 `version: 2`이고 **마이그레이션은 하지 않는다**: 모르는 버전과 손상
 * 데이터는 빈 집합으로 읽으므로 v1 데이터는 자연 폐기된다(ADR 0002).
 * 저장 키는 v1과 같다 — 같은 키에 v1로 쓰던 `/roadmap`은 제거됐으므로(ADR 0002
 * 후속) 이 키를 쓰는 곳은 여기뿐이고, 남아 있던 v1 값은 처음 읽는 순간 사라진다.
 */
import { z } from "zod";

/** 완료 집합을 읽고 쓰는 경계. 어느 구현도 던지지 않는다. */
export type ProgressRepository = {
  load(): Set<string>;
  save(completedIds: ReadonlySet<string>): void;
};

export const STARCHART_PROGRESS_STORAGE_KEY = "warframe-hub:progress";

const STORED_VERSION = 2;

// 성계 노드 id와 비노드 목표 슬러그가 한 배열에 공존한다 — 완료 집합이 하나라서다
const storedProgressSchema = z.object({
  version: z.literal(STORED_VERSION),
  completedIds: z.array(z.string()),
});

/**
 * 로컬스토리지 구현. 저장소를 주입할 수 있고(테스트·비브라우저), 저장소 접근이
 * 막힌 환경(프라이빗 모드 등)에서는 조용히 빈 진행도로 동작한다.
 */
export function createLocalStorageProgressRepository(
  storage: Storage = localStorage,
): ProgressRepository {
  return {
    load(): Set<string> {
      let raw: string | null;
      try {
        raw = storage.getItem(STARCHART_PROGRESS_STORAGE_KEY);
      } catch {
        return new Set();
      }
      if (raw === null) return new Set();

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return new Set();
      }

      const result = storedProgressSchema.safeParse(parsed);
      if (!result.success) return new Set();
      return new Set(result.data.completedIds);
    },

    save(completedIds: ReadonlySet<string>): void {
      try {
        storage.setItem(
          STARCHART_PROGRESS_STORAGE_KEY,
          JSON.stringify({
            version: STORED_VERSION,
            completedIds: [...completedIds],
          }),
        );
      } catch {
        // 저장할 수 없는 환경에서 화면이 죽어선 안 된다 — 이번 세션만 유지된다
      }
    },
  };
}
