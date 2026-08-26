import { beforeEach, describe, expect, test } from "vitest";
import {
  STARCHART_PROGRESS_STORAGE_KEY as KEY,
  createLocalStorageProgressRepository,
} from "./progress-repository";

beforeEach(() => {
  localStorage.clear();
});

const repository = () => createLocalStorageProgressRepository();

describe("createLocalStorageProgressRepository", () => {
  test("완료 집합을 저장하고 그대로 복원한다", () => {
    repository().save(new Set(["SolNode11", "quest-vors-prize"]));
    expect([...repository().load()].sort()).toEqual([
      "SolNode11",
      "quest-vors-prize",
    ]);
  });

  test("version 2로 저장한다", () => {
    repository().save(new Set(["SolNode11"]));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      version: 2,
      completedIds: ["SolNode11"],
    });
  });

  test("빈 완료 집합도 저장·복원된다", () => {
    repository().save(new Set(["SolNode11"]));
    repository().save(new Set());
    expect(repository().load().size).toBe(0);
  });

  test("저장된 것이 없으면 빈 집합이다", () => {
    expect(repository().load().size).toBe(0);
  });

  test("JSON이 아니면 빈 집합이다", () => {
    localStorage.setItem(KEY, "not-json");
    expect(repository().load().size).toBe(0);
  });

  test("스키마가 맞지 않으면 빈 집합이다", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, completedIds: "oops" }));
    expect(repository().load().size).toBe(0);
  });

  test("모르는 버전이면 빈 집합이다", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 99, completedIds: ["a"] }));
    expect(repository().load().size).toBe(0);
  });

  test("v1 데이터는 마이그레이션하지 않고 빈 집합으로 읽는다 (자연 폐기)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, completedNodeIds: ["vors-prize"] }),
    );
    expect(repository().load().size).toBe(0);
  });

  test("주입한 저장소를 쓴다", () => {
    const fake = new Map<string, string>();
    const storage = {
      getItem: (key: string) => fake.get(key) ?? null,
      setItem: (key: string, value: string) => void fake.set(key, value),
    } as Storage;

    const injected = createLocalStorageProgressRepository(storage);
    injected.save(new Set(["SolNode11"]));
    expect([...injected.load()]).toEqual(["SolNode11"]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test("저장소를 쓸 수 없는 환경에서도 던지지 않는다", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;

    const blocked = createLocalStorageProgressRepository(storage);
    expect(blocked.load().size).toBe(0);
    expect(() => blocked.save(new Set(["SolNode11"]))).not.toThrow();
  });
});
