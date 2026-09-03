import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import StarchartView from "./starchart-view";

// 3D 장면은 WebGL이 필요해 jsdom에서 뜨지 않는다 — 여기서 보는 것은 "어느 쪽을
// 띄우기로 하는가"이지 3D 자체가 아니다.
vi.mock("./scene", () => ({
  default: () => <div data-testid="scene" />,
}));

const getContext = HTMLCanvasElement.prototype.getContext;

/** WebGL이 되는 환경인 척한다 — jsdom은 기본이 "안 되는 환경"이다. */
function withWebgl() {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ getExtension: () => null }) as never,
  );
}

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
  window.localStorage.clear();
});

const fallback = () => document.querySelector("[data-group-id='Earth']");
const scene = () => screen.queryByTestId("scene");

test("WebGL 불가 환경에서는 폴백 뷰가 자동으로 뜬다", async () => {
  render(<StarchartView />);

  expect(await screen.findByText(/3D를 렌더할 수 없어/)).toBeTruthy();
  expect(fallback()).not.toBeNull();
  // 3D를 띄울 수 없는 환경에 3D로 가는 버튼을 두지 않는다
  expect(screen.queryByRole("button", { name: "3D로 보기" })).toBeNull();
});

test("WebGL이 되면 3D가 기본이고, 목록으로 수동 전환·복귀할 수 있다", async () => {
  withWebgl();
  const user = userEvent.setup();
  render(<StarchartView />);

  expect(await screen.findByTestId("scene")).toBeTruthy();
  expect(fallback()).toBeNull();

  await user.click(screen.getByRole("button", { name: "목록으로 보기" }));
  expect(fallback()).not.toBeNull();
  expect(scene()).toBeNull();

  await user.click(screen.getByRole("button", { name: "3D로 보기" }));
  expect(scene()).not.toBeNull();
  expect(fallback()).toBeNull();
});

test("폴백 뷰의 완료 체크가 같은 완료 집합에 반영된다", async () => {
  const user = userEvent.setup();
  render(<StarchartView />);
  await screen.findByText(/3D를 렌더할 수 없어/);

  const earth = document.querySelector<HTMLElement>("[data-group-id='Earth']")!;
  await user.click(earth.querySelector("summary")!);
  await user.click(screen.getByRole("checkbox", { name: /E Prime/ }));

  // 3D 뷰와 같은 저장소·같은 완료 집합이다 — 저장까지 갔는지는 저장소가 말한다
  expect(
    JSON.parse(window.localStorage.getItem("warframe-hub:progress")!),
  ).toEqual({ version: 2, completedIds: ["SolNode27"] });
  // 진행도가 생겼으므로 다음 노드가 열린다 — 파생 상태도 같은 집합을 본다
  expect(
    document.querySelector("[data-node-id='SolNode89']")?.getAttribute("data-state"),
  ).toBe("uncleared");
});

test("진행도 가져오기는 폴백 뷰에서도 열린다", async () => {
  render(<StarchartView />);
  await screen.findByText(/3D를 렌더할 수 없어/);

  expect(
    screen.getAllByRole("button", { name: "진행도 가져오기" }).length,
  ).toBeGreaterThan(0);
});

test("폴백 뷰의 구간 일괄 체크도 같은 완료 집합에 반영된다", async () => {
  const user = userEvent.setup();
  render(<StarchartView />);
  await screen.findByText(/3D를 렌더할 수 없어/);

  const earth = document.querySelector<HTMLElement>("[data-group-id='Earth']")!;
  await user.click(earth.querySelector("summary")!);
  await user.click(
    within(earth).getByRole("button", { name: "행성 전체 완료" }),
  );
  await user.click(within(earth).getByRole("button", { name: "21개 완료" }));

  // 개별 체크와 같은 저장소·같은 집합이다 — 지구 21노드가 한 번에 들어간다
  const stored = JSON.parse(
    window.localStorage.getItem("warframe-hub:progress")!,
  );
  expect(stored.version).toBe(2);
  expect(stored.completedIds).toHaveLength(21);
  // 완료가 지워지는 일은 없다 — 아코디언 제목이 그대로 21/21을 말한다
  expect(earth.textContent).toContain("21/21");
});
