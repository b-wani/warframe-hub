import { describe, expect, test } from "vitest";
import starchartJson from "@/data/starchart.json";
import layoutJson from "@/data/starchart-layout.json";
import {
  StarchartLayoutValidationError,
  buildLayout,
  formatLayout,
  loadStarchartLayout,
  validateLayout,
} from "./layout";
import type { StarchartDataset } from "./dataset";

const dataset = starchartJson as unknown as StarchartDataset;

const tinyDataset: StarchartDataset = {
  groups: {
    Mercury: { name: "수성", type: "planet" },
    RelayStationSanctuary: { name: "미션 통제실", type: "relay" },
  },
  nodes: {
    SolNode1: { name: "A", enName: "A", group: "Mercury", nextNodes: ["SolNode2"] },
    SolNode2: { name: "B", enName: "B", group: "Mercury", nextNodes: [] },
    SolNode801: {
      name: "릴레이",
      enName: "Relay",
      group: "RelayStationSanctuary",
      nextNodes: [],
    },
  },
};

describe("buildLayout", () => {
  test("빈 상태에서 좌표 대상 노드·그룹 전부에 좌표를 만든다", () => {
    const { layout, issues } = buildLayout(dataset);
    expect(issues).toEqual([]);
    expect(validateLayout(dataset, layout)).toEqual([]);
    expect(Object.keys(layout.groups)).toHaveLength(29);
    expect(Object.keys(layout.nodes)).toHaveLength(352);
  });

  test("릴레이 그룹과 그 노드에는 좌표를 만들지 않는다", () => {
    const { layout } = buildLayout(tinyDataset);
    expect(layout.groups).not.toHaveProperty("RelayStationSanctuary");
    expect(layout.nodes).not.toHaveProperty("SolNode801");
  });

  test("시드가 고정이라 재실행해도 같은 결과가 나온다", () => {
    expect(formatLayout(buildLayout(dataset).layout)).toBe(
      formatLayout(buildLayout(dataset).layout),
    );
  });

  test("이미 있는 좌표는 손대지 않는다 — 수동 보정이 살아남아야 한다", () => {
    const corrected = { groups: { Mercury: { x: 7, y: 9 } }, nodes: { SolNode1: { x: 1, y: 2 } } };
    const { layout, added } = buildLayout(tinyDataset, corrected);
    expect(layout.groups.Mercury).toEqual({ x: 7, y: 9 });
    expect(layout.nodes.SolNode1).toEqual({ x: 1, y: 2 });
    expect(added).toEqual(["SolNode2"]);
  });

  test("데이터셋에서 사라진 좌표는 걷어내고 무엇을 지웠는지 알린다", () => {
    const stale = {
      groups: {},
      nodes: { SolNode1: { x: 1, y: 2 }, SolNode999: { x: 3, y: 4 } },
    };
    const { layout, removed } = buildLayout(tinyDataset, stale);
    expect(layout.nodes).not.toHaveProperty("SolNode999");
    expect(removed).toEqual(["SolNode999"]);
  });

  test("천체 배치표가 데이터셋과 어긋나면 좌표 대신 오류를 알린다", () => {
    const unknownGroup: StarchartDataset = {
      groups: { NewPlanet: { name: "새 행성", type: "planet" } },
      nodes: {},
    };
    expect(buildLayout(unknownGroup).issues.join()).toContain("NewPlanet");
  });
});

describe("validateLayout", () => {
  const complete = buildLayout(tinyDataset).layout;

  test("좌표가 빠진 노드·그룹을 짚어낸다", () => {
    const nodes = { ...complete.nodes };
    delete nodes.SolNode1;
    expect(validateLayout(tinyDataset, { groups: {}, nodes })).toEqual([
      '그룹 "Mercury"의 좌표가 없다',
      '노드 "SolNode1"의 좌표가 없다',
    ]);
  });

  test("데이터셋에 없는 고아 좌표를 짚어낸다", () => {
    const layout = {
      groups: { ...complete.groups, Ghost: { x: 0, y: 0 } },
      nodes: complete.nodes,
    };
    expect(validateLayout(tinyDataset, layout)).toEqual([
      '고아 그룹 좌표 "Ghost" — 데이터셋에 없는 그룹이다',
    ]);
  });

  test("릴레이 좌표는 고아로 본다 — 지도에서 숨기므로 좌표 대상이 아니다", () => {
    const layout = {
      groups: { ...complete.groups, RelayStationSanctuary: { x: 0, y: 0 } },
      nodes: { ...complete.nodes, SolNode801: { x: 0, y: 0 } },
    };
    expect(validateLayout(tinyDataset, layout)).toEqual([
      '고아 그룹 좌표 "RelayStationSanctuary" — 릴레이 그룹은 지도에서 숨기므로 좌표 대상이 아니다',
      '고아 노드 좌표 "SolNode801" — 릴레이 그룹의 노드다',
    ]);
  });

  test("온전한 좌표에는 아무 말도 하지 않는다", () => {
    expect(validateLayout(tinyDataset, complete)).toEqual([]);
  });
});

describe("loadStarchartLayout", () => {
  test("검증을 통과하면 좌표를 그대로 돌려준다", () => {
    const layout = buildLayout(tinyDataset).layout;
    expect(loadStarchartLayout(tinyDataset, layout)).toEqual(layout);
  });

  test("스키마 위반은 어디가 문제인지 알려주며 실패한다", () => {
    expect(() =>
      loadStarchartLayout(tinyDataset, {
        groups: { Mercury: { x: "0", y: 0 } },
        nodes: {},
      }),
    ).toThrow(StarchartLayoutValidationError);
  });

  test("정수가 아닌 좌표는 거부한다 — 손으로 고치는 파일이다", () => {
    const layout = buildLayout(tinyDataset).layout;
    expect(() =>
      loadStarchartLayout(tinyDataset, {
        ...layout,
        nodes: { ...layout.nodes, SolNode1: { x: 1.5, y: 0 } },
      }),
    ).toThrow(StarchartLayoutValidationError);
  });

  test("좌표가 빠지면 무엇이 빠졌는지 담아 실패한다", () => {
    expect(() =>
      loadStarchartLayout(tinyDataset, { groups: {}, nodes: {} }),
    ).toThrow(/SolNode1/);
  });
});

describe("formatLayout", () => {
  test("줄바꿈으로 끝나는 2칸 들여쓰기 JSON을 만든다 — 에디터에서 고칠 파일이다", () => {
    const text = formatLayout({ groups: { A: { x: 1, y: 2 } }, nodes: {} });
    expect(text).toBe(
      '{\n  "groups": {\n    "A": { "x": 1, "y": 2 }\n  },\n  "nodes": {}\n}\n',
    );
  });
});

describe("커밋된 좌표 데이터셋", () => {
  test("커밋된 정제 노드 데이터셋과 어긋나지 않는다", () => {
    expect(() => loadStarchartLayout(dataset, layoutJson)).not.toThrow();
  });

  test("생성 스크립트를 다시 돌려도 좌표가 바뀌지 않는다 — 파일이 최신이다", () => {
    const layout = loadStarchartLayout(dataset, layoutJson);
    expect(buildLayout(dataset, layout)).toMatchObject({
      layout,
      issues: [],
      added: [],
      removed: [],
    });
  });
});
