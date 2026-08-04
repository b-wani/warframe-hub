import { expect, test } from "vitest";
import { getRoadmap } from "./roadmap";

test("번들된 로드맵 데이터가 검증을 통과한다", () => {
  const roadmap = getRoadmap();
  expect(roadmap.nodes.length).toBeGreaterThan(0);
  expect(roadmap.sources.length).toBeGreaterThan(0);
});
