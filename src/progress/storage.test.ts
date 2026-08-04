import { beforeEach, describe, expect, test } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  loadProgress,
  saveProgress,
} from "./storage";

beforeEach(() => {
  localStorage.clear();
});

describe("saveProgress / loadProgress", () => {
  test("저장한 완료 집합을 그대로 복원한다", () => {
    saveProgress(localStorage, new Set(["a", "b"]));
    expect([...loadProgress(localStorage)].sort()).toEqual(["a", "b"]);
  });

  test("저장 데이터에 버전 필드가 있다", () => {
    saveProgress(localStorage, new Set(["a"]));
    const raw = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!);
    expect(raw.version).toBe(1);
  });

  test("저장된 것이 없으면 빈 집합을 돌려준다", () => {
    expect(loadProgress(localStorage).size).toBe(0);
  });

  test("JSON이 아닌 값이 저장돼 있으면 빈 집합을 돌려준다", () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, "not-json");
    expect(loadProgress(localStorage).size).toBe(0);
  });

  test("스키마가 맞지 않는 값이 저장돼 있으면 빈 집합을 돌려준다", () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 1, completedNodeIds: "oops" }),
    );
    expect(loadProgress(localStorage).size).toBe(0);
  });

  test("모르는 버전이면 빈 집합을 돌려준다", () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 99, completedNodeIds: ["a"] }),
    );
    expect(loadProgress(localStorage).size).toBe(0);
  });
});
