import nodes from "@/data/roadmap-nodes.json";
import sources from "@/data/sources.json";
import { loadRoadmap } from "./load";
import type { Roadmap } from "./schema";

/** 저장소에 번들된 로드맵 데이터를 검증해서 돌려준다. */
export function getRoadmap(): Roadmap {
  return loadRoadmap({ nodes, sources });
}
