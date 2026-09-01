import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { FallbackView } from "./fallback-view";

/** 행성 아코디언 하나 — 접근성 이름이 아니라 그룹 id로 집는다. */
const groupSection = (id: string) =>
  document.querySelector<HTMLElement>(`[data-group-id="${id}"]`);

/** 지구 아코디언을 펼치고 그 안을 돌려준다. */
async function openEarth(user: ReturnType<typeof userEvent.setup>) {
  const earth = groupSection("Earth")!;
  await user.click(within(earth).getByText("지구"));
  return earth;
}

/** 노드 한 줄 — 체크박스와 상태 표기가 같은 줄에 있다. */
function nodeRow(scope: HTMLElement, name: string) {
  const checkbox = within(scope).getByRole("checkbox", {
    name: new RegExp(name),
  });
  return { checkbox, row: checkbox.closest("li")! };
}

test("진행도 대상 행성이 아코디언으로 전부 나온다 — 릴레이는 없다", () => {
  render(<FallbackView completedIds={new Set()} onToggle={() => {}} />);

  expect(groupSection("Earth")?.textContent).toContain("지구");
  expect(groupSection("Void")?.textContent).toContain("보이드");
  expect(groupSection("Earth_SPACE")?.textContent).toContain("지구 프록시마");
  expect(groupSection("RelayStationSanctuary")).toBeNull();
});

test("행성 제목이 완료 개수를 알린다", () => {
  render(
    <FallbackView completedIds={new Set(["SolNode27"])} onToggle={() => {}} />,
  );
  expect(groupSection("Earth")?.textContent).toContain("1/21");
});

test("펼치면 노드가 표시명·파생 3상태와 함께 체크리스트로 나온다", async () => {
  const user = userEvent.setup();
  render(<FallbackView completedIds={new Set()} onToggle={() => {}} />);
  const earth = await openEarth(user);

  // 진행도가 비어 있으면 진입 노드만 열려 있고 그 뒤는 잠긴다 — 저장값이 아니라
  // 완료 집합에서 파생한 상태다
  expect(nodeRow(earth, "E Prime").row.textContent).toContain("미클리어");
  expect(nodeRow(earth, "Mariana").row.textContent).toContain("잠김");
  expect(nodeRow(earth, "금성 교차점").row.textContent).toContain("교차점");
});

test("완료한 노드는 체크돼 있고 다음 노드가 열린다", async () => {
  const user = userEvent.setup();
  render(
    <FallbackView completedIds={new Set(["SolNode27"])} onToggle={() => {}} />,
  );
  const earth = await openEarth(user);

  expect(nodeRow(earth, "E Prime").checkbox).toHaveProperty("checked", true);
  expect(nodeRow(earth, "Mariana").row.textContent).toContain("미클리어");
});

test("체크는 완료 집합을 바꾸라고 위로 알린다", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(<FallbackView completedIds={new Set()} onToggle={onToggle} />);
  const earth = await openEarth(user);

  await user.click(nodeRow(earth, "E Prime").checkbox);
  expect(onToggle).toHaveBeenCalledExactlyOnceWith("SolNode27");
});

test("잠긴 노드도 체크할 수 있다 — 진행도는 사용자가 아는 사실이다", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(<FallbackView completedIds={new Set()} onToggle={onToggle} />);
  const earth = await openEarth(user);

  const { checkbox } = nodeRow(earth, "Mariana");
  expect(checkbox).toHaveProperty("disabled", false);
  await user.click(checkbox);
  expect(onToggle).toHaveBeenCalledExactlyOnceWith("SolNode89");
});
