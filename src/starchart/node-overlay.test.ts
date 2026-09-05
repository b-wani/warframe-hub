import { describe, expect, test } from "vitest";
import overlaysJson from "@/data/node-overlays.json";
import { starchartDataset as dataset } from "./data";
import {
  majorNodeIds,
  nodeOverlays,
  patchBaseline,
} from "./node-overlay";

const { overlays, issues } = nodeOverlays(dataset, overlaysJson);

/** 스키마를 채운 최소 오버레이 하나 — 검사하려는 것만 덮어쓴다. */
const sample = (extra: Record<string, unknown> = {}) => ({
  summary: "요약",
  sourceIds: ["wiki-venus-junction"],
  basedOnPatch: "Update 43",
  ...extra,
});

describe("커밋된 큐레이션 오버레이", () => {
  test("문제 없이 읽힌다", () => {
    expect(issues).toEqual([]);
  });

  test("32노드 저작은 범위 밖이라 샘플만 실려 있다", () => {
    // 그릇을 증명할 만큼만 — 본문 저작은 스펙 이후 단계다(스펙 §9)
    expect(overlays.size).toBeGreaterThan(0);
    expect(overlays.size).toBeLessThanOrEqual(2);
  });

  test("주요 노드에만 붙어 있다", () => {
    const major = majorNodeIds(dataset);
    for (const id of overlays.keys()) expect(major.has(id)).toBe(true);
  });
});

describe("majorNodeIds", () => {
  test("교차점과 보스 노드를 데이터셋에서 파생한다", () => {
    const ids = majorNodeIds(dataset);
    for (const id of ids) {
      expect(dataset.nodes[id]?.missionType).toMatch(
        /^MT_(JUNCTION|ASSASSINATION)$/,
      );
    }
    // 스펙 §3.3은 32개(교차점 12 + 보스 20)라고 적지만 데이터셋의 교차점은 13개다.
    // 판별은 데이터셋에서 파생하는 것이므로(AC2) 여기서 하나를 골라 버리지 않는다 —
    // 스펙의 셈과 데이터셋이 갈리면 데이터셋이 사실이다.
    const junctions = [...ids].filter(
      (id) => dataset.nodes[id]?.missionType === "MT_JUNCTION",
    );
    expect(junctions).toHaveLength(13);
    expect(ids.size).toBe(33);
  });
});

describe("nodeOverlays", () => {
  test("노드 id로 찾는다", () => {
    const { overlays } = nodeOverlays(dataset, {
      EarthToVenusJunction: sample({ summary: "금성 교차점" }),
    });
    expect(overlays.get("EarthToVenusJunction")?.summary).toBe("금성 교차점");
    expect(overlays.get("SolNode104")).toBeUndefined();
  });

  test("정제 노드 데이터셋에 없는 노드 id를 키로 쓰면 그 오버레이가 빠진다", () => {
    const { overlays, issues } = nodeOverlays(dataset, {
      NotANode: sample(),
      EarthToVenusJunction: sample(),
    });
    expect(overlays.has("NotANode")).toBe(false);
    expect(overlays.has("EarthToVenusJunction")).toBe(true);
    expect(issues).toEqual([expect.stringContaining("NotANode")]);
  });

  test("주요 노드가 아닌 노드에 붙으면 빠진다", () => {
    // 화성 올림푸스는 일반 노드다 — 큐레이션 대상은 교차점·보스뿐이다
    const { overlays, issues } = nodeOverlays(dataset, {
      SolNode30: sample(),
    });
    expect(overlays.size).toBe(0);
    expect(issues).toEqual([expect.stringContaining("SolNode30")]);
  });

  test("스키마가 어긋나면 파일 전체가 빠진다", () => {
    const { overlays, issues } = nodeOverlays(dataset, {
      EarthToVenusJunction: { summary: "출처가 없다", basedOnPatch: "Update 43" },
    });
    expect(overlays.size).toBe(0);
    expect(issues).toHaveLength(1);
  });

  test("보스 드랍은 보스 노드에만 남는다", () => {
    const { overlays, issues } = nodeOverlays(dataset, {
      SolNode104: sample({ drops: ["라이노 섀시 설계도"] }),
      EarthToVenusJunction: sample({ drops: ["있을 수 없는 드랍"] }),
    });
    expect(overlays.get("SolNode104")?.drops).toEqual(["라이노 섀시 설계도"]);
    // 교차점은 보스를 잡는 자리가 아니다 — 나머지 본문까지 버릴 이유는 없다
    expect(overlays.get("EarthToVenusJunction")?.drops).toBeUndefined();
    expect(overlays.get("EarthToVenusJunction")?.summary).toBe("요약");
    expect(issues).toEqual([expect.stringContaining("EarthToVenusJunction")]);
  });

  test("빈 목록은 비어 있는 채로 온다 — 없는 줄은 화면에도 없다", () => {
    const { overlays } = nodeOverlays(dataset, {
      EarthToVenusJunction: sample(),
    });
    const overlay = overlays.get("EarthToVenusJunction");
    expect(overlay?.preparations).toEqual([]);
    expect(overlay?.cautions).toEqual([]);
    expect(overlay?.spoiler).toBe(false);
  });
});

describe("patchBaseline", () => {
  test("노드별 기준 패치를 중복 없이 모은다", () => {
    const { overlays } = nodeOverlays(dataset, {
      EarthToVenusJunction: sample(),
      SolNode104: sample({ basedOnPatch: "Update 43" }),
      SolNode24: sample({ basedOnPatch: "Update 42" }),
    });
    expect(patchBaseline(overlays)).toEqual(["Update 43", "Update 42"]);
  });

  test("실린 콘텐츠가 없으면 표기할 기준 패치도 없다", () => {
    expect(patchBaseline(new Map())).toEqual([]);
  });
});
