import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getRoadmap } from "@/roadmap/roadmap";
import type { RoadmapNode } from "@/roadmap/schema";
import { toWorldState } from "@/worldstate/adapter";
import cetusCycle from "@/worldstate/fixtures/cetus-cycle.json";
import earthCycle from "@/worldstate/fixtures/earth-cycle.json";
import voidTrader from "@/worldstate/fixtures/void-trader.json";
import { ContextWidget } from "./widget";

const now = Date.parse("2026-08-20T10:24:00.000Z");
const nodesById = new Map(getRoadmap().nodes.map((n) => [n.id, n]));

function node(id: string): RoadmapNode {
  return nodesById.get(id)!;
}

function stubWorldState(raw: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(toWorldState(raw, { fetchedAt: now }))),
  );
}

function stubApiDown() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("네트워크 차단");
    }),
  );
}

async function renderWidget(nextGoals: RoadmapNode[]) {
  render(<ContextWidget nextGoals={nextGoals} />);
  // 마운트 후의 fetch + 시각 계산이 반영될 때까지 기다린다
  await screen.findByRole("region", { name: "현재 단계 문맥 정보" });
  await vi.waitFor(() => {
    expect(screen.queryByText("불러오는 중")).toBeNull();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("보이드 상인 도착까지 남은 시간을 보여준다", async () => {
  stubWorldState({ voidTrader, earthCycle, cetusCycle });

  await renderWidget([node("mars-junction")]);

  expect(
    screen.getByText(/Baro Ki'Teer 도착까지 1일 2시간 · Orcus Relay \(Pluto\)/),
  ).toBeDefined();
});

test("현재 단계와 관련된 낮밤 주기만 보여준다", async () => {
  stubWorldState({ voidTrader, earthCycle, cetusCycle });

  await renderWidget([node("mars-junction")]);

  expect(screen.getByText("지구 낮밤 주기")).toBeDefined();
  expect(screen.getByText(/낮 — 전환까지 1시간 36분/)).toBeDefined();
  expect(screen.queryByText(/시터스/)).toBeNull();
});

test("단계가 바뀌면 위젯 내용도 바뀐다", async () => {
  stubWorldState({ voidTrader, earthCycle, cetusCycle });

  await renderWidget([node("rhino-prep")]);

  expect(screen.queryByText("지구 낮밤 주기")).toBeNull();
  const materials = screen.getByRole("region", {
    name: "이번 단계 재료 획득처",
  });
  expect(
    within(materials).getByText(/라이노 본체 설계도 ×1 — 마켓에서 크레딧으로 구매/),
  ).toBeDefined();
});

test("월드스테이트를 못 받으면 실시간 항목만 정보 없음으로 폴백한다", async () => {
  stubApiDown();

  await renderWidget([node("rhino-prep")]);

  const widget = screen.getByRole("region", { name: "현재 단계 문맥 정보" });
  expect(within(widget).getByText("정보 없음")).toBeDefined();
  // 로드맵 데이터에서 나오는 안내는 외부 API와 무관하게 남는다
  expect(
    within(widget).getByRole("region", { name: "이번 단계 재료 획득처" }),
  ).toBeDefined();
});

test("응답에 섹션이 비어 있어도 정보 없음으로 표시한다", async () => {
  stubWorldState({});

  await renderWidget([node("mars-junction")]);

  const widget = screen.getByRole("region", { name: "현재 단계 문맥 정보" });
  expect(within(widget).getAllByText("정보 없음").length).toBe(2);
});
