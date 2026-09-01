/**
 * 온보딩 배너의 해제 기록 저장 경계 (스펙 §5).
 *
 * 완료 집합과 같은 저장소에 두지 않는다 — 진행도가 아니라 화면을 한 번 닫았다는
 * 사실이고, 진행도 전체 초기화가 이것까지 지워서는 안 된다(닫은 배너가 초기화
 * 때문에 되살아나면 사용자가 두 번 닫아야 한다).
 *
 * 완료 집합 저장소와 같은 규약을 따른다: 절대 던지지 않으며, 저장소 접근이 막힌
 * 환경에서는 "아직 안 닫았다"로 조용히 동작한다.
 */

/** 배너를 닫았는지 읽고 쓰는 경계. 어느 구현도 던지지 않는다. */
export type OnboardingRepository = {
  isDismissed(): boolean;
  dismiss(): void;
};

export const STARCHART_ONBOARDING_STORAGE_KEY =
  "warframe-hub:starchart-import-onboarding-dismissed";

export function createLocalStorageOnboardingRepository(
  storage: Storage = localStorage,
): OnboardingRepository {
  return {
    isDismissed(): boolean {
      try {
        return storage.getItem(STARCHART_ONBOARDING_STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    },
    dismiss(): void {
      try {
        storage.setItem(STARCHART_ONBOARDING_STORAGE_KEY, "1");
      } catch {
        // 저장할 수 없는 환경에서도 이번 세션에는 닫힌 채로 남는다
      }
    },
  };
}
