import { beforeEach, describe, expect, test } from "vitest";
import {
  createLocalStorageOnboardingRepository,
  STARCHART_ONBOARDING_STORAGE_KEY,
} from "./onboarding-repository";

describe("createLocalStorageOnboardingRepository", () => {
  beforeEach(() => localStorage.clear());

  test("처음에는 닫히지 않은 상태다", () => {
    expect(createLocalStorageOnboardingRepository().isDismissed()).toBe(false);
  });

  test("닫으면 영구히 기록된다 — 새 인스턴스도 같은 답을 준다", () => {
    createLocalStorageOnboardingRepository().dismiss();
    expect(createLocalStorageOnboardingRepository().isDismissed()).toBe(true);
    expect(localStorage.getItem(STARCHART_ONBOARDING_STORAGE_KEY)).toBe("1");
  });

  test("저장소가 막혀 있어도 던지지 않는다", () => {
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    const repository = createLocalStorageOnboardingRepository(blocked);
    expect(repository.isDismissed()).toBe(false);
    expect(() => repository.dismiss()).not.toThrow();
  });
});
