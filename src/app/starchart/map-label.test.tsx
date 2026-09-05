import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { MapLabel } from "./map-label";

// drei `Html`은 r3f 캔버스 안에서만 산다 — 여기서 보는 것은 라벨이 상태를 어떻게
// 알리는가이지 3D 배치가 아니므로, 자식을 그대로 두는 껍데기로 바꾼다.
vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const noop = () => {};

test("잠긴 노드에는 자물쇠가 붙고 글로도 읽힌다 — 색만으로 알리지 않는다", () => {
  render(
    <MapLabel id="SolNode89" kind="node" position={[0, 0, 0]} state="locked" onSelect={noop}>
      Mariana
    </MapLabel>,
  );
  const label = screen.getByRole("button", { name: /Mariana/ });
  expect(label.getAttribute("data-node-id")).toBe("SolNode89");
  expect(label.getAttribute("data-state")).toBe("locked");
  expect(screen.getByRole("img", { name: "잠김" }).textContent).toBe("🔒");
});

test("미클리어·클리어에는 표식이 없다 — 인게임도 자물쇠는 잠긴 노드에만 붙인다", () => {
  for (const state of ["uncleared", "cleared"] as const) {
    const { unmount } = render(
      <MapLabel id="SolNode27" kind="node" position={[0, 0, 0]} state={state} onSelect={noop}>
        E Prime
      </MapLabel>,
    );
    expect(screen.getByRole("button").getAttribute("data-state")).toBe(state);
    expect(screen.queryByRole("img")).toBeNull();
    unmount();
  }
});

test("행성 전체 클리어면 천체 라벨에 완료 체크가 붙는다", () => {
  render(
    <MapLabel id="Earth" kind="body" position={[0, 0, 0]} state="complete" onSelect={noop}>
      지구
    </MapLabel>,
  );
  const label = screen.getByRole("button", { name: /지구/ });
  expect(label.getAttribute("data-body-id")).toBe("Earth");
  expect(label.getAttribute("data-state")).toBe("complete");
  expect(screen.getByRole("img", { name: "완료" }).textContent).toBe("✓");
});

test("상태가 없으면 data-state도 없다 — 미완료 행성은 표식 없는 이름표다", () => {
  render(
    <MapLabel id="Mars" kind="body" position={[0, 0, 0]} onSelect={noop}>
      화성
    </MapLabel>,
  );
  expect(screen.getByRole("button").hasAttribute("data-state")).toBe(false);
});

test("라벨은 손잡이다 — 누르면 자기 id로 알린다", async () => {
  const onSelect = vi.fn();
  render(
    <MapLabel id="SolNode27" kind="node" position={[0, 0, 0]} onSelect={onSelect}>
      E Prime
    </MapLabel>,
  );
  await userEvent.setup().click(screen.getByRole("button"));
  expect(onSelect).toHaveBeenCalledWith("SolNode27");
});
