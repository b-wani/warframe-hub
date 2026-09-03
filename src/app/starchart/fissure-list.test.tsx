import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { FissureMarker } from "@/starchart/fissures";
import { FissureList } from "./fissure-list";

const now = Date.parse("2026-08-20T10:30:00.000Z");

function marker(fields: Partial<FissureMarker> = {}): FissureMarker {
  return {
    nodeId: "SolNode27",
    nodeName: "E Prime",
    bodyId: "Earth",
    bodyName: "지구",
    tier: "Lith",
    tierName: "리스",
    hard: false,
    expiryAt: now + 32 * 60_000,
    ...fields,
  };
}

test("활성 균열 개수를 알리고, 펼치면 로테이션·행성·남은 시간이 함께 읽힌다", async () => {
  const user = userEvent.setup();
  render(<FissureList markers={[marker()]} status="ok" now={now} onGo={() => {}} />);

  const toggle = screen.getByRole("button", { name: /보이드 균열 1/ });
  expect(screen.queryByRole("list")).toBeNull();

  await user.click(toggle);
  const item = screen.getByRole("button", { name: /E Prime/ });
  expect(item.textContent).toContain("리스");
  expect(item.textContent).toContain("지구");
  expect(item.textContent).toContain("32분");
});

test("항목을 고르면 그 노드로 가라고 알린다", async () => {
  const user = userEvent.setup();
  const onGo = vi.fn();
  const axi = marker({ nodeId: "SolNode89", nodeName: "Mariana", tier: "Axi", tierName: "액시" });
  render(<FissureList markers={[marker(), axi]} status="ok" now={now} onGo={onGo} />);

  await user.click(screen.getByRole("button", { name: /보이드 균열/ }));
  await user.click(screen.getByRole("button", { name: /Mariana/ }));

  expect(onGo).toHaveBeenCalledWith(axi);
});

test("활성 균열이 없으면 없다고 말한다 — 빈 목록을 지어내지 않는다", async () => {
  const user = userEvent.setup();
  render(<FissureList markers={[]} status="ok" now={now} onGo={() => {}} />);

  await user.click(screen.getByRole("button", { name: /보이드 균열/ }));
  expect(screen.getByText(/활성 균열이 없습니다/)).toBeTruthy();
});

test("월드스테이트를 못 받으면 그 사실을 알리고 지도는 그대로다", async () => {
  const user = userEvent.setup();
  render(<FissureList markers={[]} status="unavailable" now={now} onGo={() => {}} />);

  await user.click(screen.getByRole("button", { name: /보이드 균열/ }));
  expect(screen.getByText(/받지 못해/)).toBeTruthy();
  expect(screen.queryByText(/활성 균열이 없습니다/)).toBeNull();
});

test("마지막 성공 스냅숏으로 대체된 값이면 그렇다고 알린다", async () => {
  const user = userEvent.setup();
  render(<FissureList markers={[marker()]} status="stale" now={now} onGo={() => {}} />);

  await user.click(screen.getByRole("button", { name: /보이드 균열/ }));
  expect(screen.getByText(/마지막으로 받은/)).toBeTruthy();
});

test("같은 노드·등급의 스틸패스 균열은 일반 균열과 구별돼 나란히 선다", async () => {
  const user = userEvent.setup();
  render(
    <FissureList
      markers={[marker(), marker({ hard: true })]}
      status="ok"
      now={now}
      onGo={() => {}}
    />,
  );

  await user.click(screen.getByRole("button", { name: /보이드 균열 2/ }));
  const items = screen.getAllByRole("button", { name: /E Prime/ });
  expect(items).toHaveLength(2);
  expect(items[0].textContent).not.toContain("스틸패스");
  expect(items[1].textContent).toContain("스틸패스");
});
