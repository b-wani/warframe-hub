import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createLocalStorageProgressRepository,
  STARCHART_PROGRESS_STORAGE_KEY,
  type ProgressRepository,
} from "@/starchart/progress-repository";
import { useStarchartProgress } from "./use-progress";

function fakeRepository(initial: string[] = []): ProgressRepository & {
  saved: string[][];
} {
  const saved: string[][] = [];
  return {
    saved,
    load: () => new Set(initial),
    save: (ids) => {
      saved.push([...ids].sort());
    },
  };
}

describe("useStarchartProgress", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("저장된 완료 집합을 첫 렌더에 읽는다", () => {
    const { result } = renderHook(() =>
      useStarchartProgress(fakeRepository(["SolNode27"])),
    );
    expect([...result.current.completedIds]).toEqual(["SolNode27"]);
  });

  test("토글은 완료를 켜고 끄며 그때마다 저장한다", () => {
    const repository = fakeRepository();
    const { result } = renderHook(() => useStarchartProgress(repository));

    act(() => result.current.toggle("SolNode27"));
    expect([...result.current.completedIds]).toEqual(["SolNode27"]);

    act(() => result.current.toggle("SolNode89"));
    act(() => result.current.toggle("SolNode27"));
    expect([...result.current.completedIds]).toEqual(["SolNode89"]);

    expect(repository.saved).toEqual([
      ["SolNode27"],
      ["SolNode27", "SolNode89"],
      ["SolNode89"],
    ]);
  });

  test("완료 집합은 토글할 때만 새 객체가 된다 — 파생 계산을 헛돌게 하지 않는다", () => {
    const { result, rerender } = renderHook(() =>
      useStarchartProgress(fakeRepository()),
    );
    const first = result.current.completedIds;
    rerender();
    expect(result.current.completedIds).toBe(first);

    act(() => result.current.toggle("SolNode27"));
    expect(result.current.completedIds).not.toBe(first);
  });

  test("기본 저장소는 로컬스토리지다 — 새로고침해도 완료가 남는다", () => {
    const { result } = renderHook(() => useStarchartProgress());
    act(() => result.current.toggle("SolNode27"));

    expect(
      createLocalStorageProgressRepository().load().has("SolNode27"),
    ).toBe(true);
    expect(localStorage.getItem(STARCHART_PROGRESS_STORAGE_KEY)).toContain(
      "SolNode27",
    );
  });
});

describe("useStarchartProgress — 가져오기와 초기화", () => {
  test("병합은 합집합이다 — 기존 완료를 지우지 않는다", () => {
    const repository = fakeRepository(["SolNode27", "quest-vor-prize"]);
    const { result } = renderHook(() => useStarchartProgress(repository));

    act(() => result.current.merge(["SolNode27", "SolNode89"]));

    expect([...result.current.completedIds].sort()).toEqual([
      "SolNode27",
      "SolNode89",
      "quest-vor-prize",
    ]);
    expect(repository.saved).toEqual([
      ["SolNode27", "SolNode89", "quest-vor-prize"],
    ]);
  });

  test("같은 병합을 다시 해도 완료가 그대로다 — 재실행이 무해하다", () => {
    const { result } = renderHook(() =>
      useStarchartProgress(fakeRepository(["SolNode27"])),
    );

    act(() => result.current.merge(["SolNode27"]));
    act(() => result.current.merge(["SolNode27"]));
    expect([...result.current.completedIds]).toEqual(["SolNode27"]);
  });

  test("초기화는 완료 집합을 비우고 그것까지 저장한다", () => {
    const repository = fakeRepository(["SolNode27", "SolNode89"]);
    const { result } = renderHook(() => useStarchartProgress(repository));

    act(() => result.current.reset());

    expect([...result.current.completedIds]).toEqual([]);
    expect(repository.saved).toEqual([[]]);
  });
});
