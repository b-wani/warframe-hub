import { describe, expect, test } from "vitest";
import guidesJson from "@/data/planet-guides.json";
import { starchartDataset as dataset } from "./data";
import { nonNodeObjectiveSlugs, planetGuides } from "./planet-guide";

const { guides, issues } = planetGuides(dataset, guidesJson);

describe("커밋된 행성 가이드", () => {
  test("문제 없이 읽힌다", () => {
    expect(issues).toEqual([]);
  });

  test("비노드 목표는 잠정 목록 그대로다 — 확정 재선정은 저작 단계 소관이다", () => {
    // 옛 로드맵(/roadmap 제거 전)의 비노드 항목 = 퀘스트 8 + 라이노 준비 1.
    // 스펙이 적어 둔 "퀘스트 7"은 교차점 7과 자릿수가 엇갈린 셈으로 보인다 —
    // 목록의 확정은 저작 단계 소관이므로(스펙 §9) 여기서 하나를 골라 버리지 않는다.
    const slugs = nonNodeObjectiveSlugs(guides);
    expect(slugs.size).toBe(9);
    expect(slugs.has("rhino-prep")).toBe(true);
  });

  test("교차점은 비노드 목표가 아니다 — 노드 완료로만 추적한다", () => {
    for (const slug of nonNodeObjectiveSlugs(guides)) {
      expect(dataset.nodes[slug]).toBeUndefined();
    }
  });

  test("가이드는 성계 뷰에 있는 천체에만 붙는다", () => {
    for (const body of guides.keys()) {
      expect(dataset.groups[body]?.type).toMatch(/^(planet|special)$/);
    }
  });

  test("기준 패치가 가이드마다 펴져 있다 — 화면이 파일을 몰라도 된다", () => {
    for (const guide of guides.values()) {
      expect(guide.basedOnPatch).toBe(guidesJson.basedOnPatch);
    }
  });
});

describe("planetGuides", () => {
  const file = (guides: unknown[]) => ({ basedOnPatch: "Update 43", guides });

  test("천체 id로 찾는다", () => {
    const { guides } = planetGuides(
      dataset,
      file([{ body: "Earth", summary: "지구", objectives: [] }]),
    );
    expect(guides.get("Earth")?.summary).toBe("지구");
    expect(guides.get("Venus")).toBeUndefined();
  });

  test("본문은 없어도 된다 — 저작은 스펙 이후 단계다", () => {
    const { guides, issues } = planetGuides(
      dataset,
      file([{ body: "Earth", objectives: [] }]),
    );
    expect(issues).toEqual([]);
    expect(guides.get("Earth")?.summary).toBeUndefined();
  });

  test("스키마와 다른 파일은 던지지 않고 문제로 알린다", () => {
    const { guides, issues } = planetGuides(dataset, { guides: "지구" });
    expect(guides.size).toBe(0);
    expect(issues).toHaveLength(1);
  });

  test("성계 뷰에 없는 천체의 가이드는 빠진다 — 닿을 화면이 없다", () => {
    for (const body of ["Earth_SPACE", "RelayStationSanctuary", "Nowhere"]) {
      const { guides, issues } = planetGuides(
        dataset,
        file([{ body, objectives: [] }]),
      );
      expect(guides.size).toBe(0);
      expect(issues).toHaveLength(1);
    }
  });

  test("같은 천체에 가이드가 둘이면 문제로 알린다", () => {
    const { guides, issues } = planetGuides(
      dataset,
      file([
        { body: "Earth", summary: "먼저", objectives: [] },
        { body: "Earth", summary: "나중", objectives: [] },
      ]),
    );
    expect(guides.get("Earth")?.summary).toBe("먼저");
    expect(issues).toHaveLength(1);
  });

  test("슬러그가 성계 노드 id와 겹치면 문제로 알린다", () => {
    const { issues } = planetGuides(
      dataset,
      file([
        {
          body: "Earth",
          objectives: [
            { slug: "SolNode27", kind: "quest", title: "노드를 흉내 낸 목표" },
          ],
        },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("SolNode27");
  });

  test("슬러그가 두 천체에서 겹치면 문제로 알린다", () => {
    const objectives = [{ slug: "natah", kind: "quest", title: "나타" }];
    const { issues } = planetGuides(
      dataset,
      file([
        { body: "Uranus", objectives },
        { body: "Neptune", objectives },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("natah");
  });
});
