import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { starchartProgressGraph } from "@/starchart/data";
import { bulkCompletion } from "@/starchart/progress";
import { BulkComplete } from "./bulk-complete";

// 실제 데이터셋을 그대로 쓴다 — 확인 단계가 알리는 개수가 맞는지는 진짜 그래프
// 위에서만 확인할 수 있다. 지구는 진입 노드 E Prime(SolNode27) → Mariana
// (SolNode89) 순이고, 진행도 대상 노드가 21개다.
const marianaThrough = { kind: "through", id: "SolNode89" } as const;
const earthGroup = { kind: "group", id: "Earth" } as const;

const action = (name: string) => screen.getByRole("button", { name });

test("확인 단계가 새로 완료되는 개수를 알린다", async () => {
  const user = userEvent.setup();
  render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set()}
      onComplete={vi.fn()}
    />,
  );

  await user.click(action("여기까지 완료"));

  // E Prime + Mariana = 2개. 선행을 빠뜨리거나 겹쳐 세면 여기서 드러난다
  expect(screen.getByText(/2개가 새로 완료됩니다/)).toBeTruthy();
});

test("확정하면 확인 단계가 센 그 노드들만 위로 알린다", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set()}
      onComplete={onComplete}
    />,
  );

  await user.click(action("여기까지 완료"));
  await user.click(action("2개 완료"));

  expect(onComplete).toHaveBeenCalledOnce();
  const added: ReadonlySet<string> = onComplete.mock.calls[0][0];
  expect([...added].sort()).toEqual(["SolNode27", "SolNode89"]);
});

test("취소하면 아무것도 반영되지 않고 버튼으로 돌아온다", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set()}
      onComplete={onComplete}
    />,
  );

  await user.click(action("여기까지 완료"));
  await user.click(action("취소"));

  expect(onComplete).not.toHaveBeenCalled();
  expect(action("여기까지 완료")).toBeTruthy();
});

test("자신과 선행이 모두 완료된 노드에는 버튼이 없다", () => {
  const { container } = render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set(["SolNode27", "SolNode89"])}
      onComplete={vi.fn()}
    />,
  );
  expect(container.innerHTML).toBe("");
});

test("자신만 완료됐고 선행이 비어 있으면 아직 버튼이 있다", () => {
  render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set(["SolNode89"])}
      onComplete={vi.fn()}
    />,
  );
  expect(action("여기까지 완료")).toBeTruthy();
});

test("확인을 띄운 뒤 진행도가 바뀌면 그 확인은 무효가 된다", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const { rerender } = render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set()}
      onComplete={onComplete}
    />,
  );
  await user.click(action("여기까지 완료"));
  expect(screen.getByText(/2개가 새로 완료됩니다/)).toBeTruthy();

  // 다른 곳에서 진행도가 바뀌었다 — 읽은 개수(2)와 반영될 집합(1)이 어긋난다
  rerender(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set(["SolNode27"])}
      onComplete={onComplete}
    />,
  );

  expect(screen.queryByRole("button", { name: "2개 완료" })).toBeNull();
  expect(screen.getByText(/진행도가 바뀌어/)).toBeTruthy();

  // 다시 확인하면 그때의 개수를 센다
  await user.click(action("여기까지 완료"));
  expect(screen.getByText(/1개가 새로 완료됩니다/)).toBeTruthy();
});

test("행성 전체 완료도 같은 확인 단계를 거친다", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(
    <BulkComplete
      target={earthGroup}
      completedIds={new Set()}
      onComplete={onComplete}
    />,
  );

  await user.click(action("행성 전체 완료"));
  expect(screen.getByText(/21개가 새로 완료됩니다/)).toBeTruthy();

  await user.click(action("21개 완료"));
  expect(onComplete.mock.calls[0][0].size).toBe(21);
});

test("행성을 다 클리어했으면 행성 전체 완료 버튼도 없다", () => {
  // 일괄 체크가 채울 집합 그대로를 진행도로 준다 — 확정 뒤의 상태다
  const filled = bulkCompletion(starchartProgressGraph, new Set(), earthGroup);
  const { container } = render(
    <BulkComplete
      target={earthGroup}
      completedIds={filled}
      onComplete={vi.fn()}
    />,
  );
  expect(container.innerHTML).toBe("");
});

test("같은 완료 집합을 새 객체로 다시 받아도 확인은 살아 있다", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set(["SolNode27"])}
      onComplete={vi.fn()}
    />,
  );
  await user.click(action("여기까지 완료"));
  expect(screen.getByText(/1개가 새로 완료됩니다/)).toBeTruthy();

  // 진행이 바뀐 것이 아니라 같은 사실을 다른 객체로 다시 준 것뿐이다 —
  // 참조로만 보면 여기서 멀쩡한 확인이 무효가 된다
  rerender(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set(["SolNode27"])}
      onComplete={vi.fn()}
    />,
  );

  expect(action("1개 완료")).toBeTruthy();
  expect(screen.queryByText(/진행도가 바뀌어/)).toBeNull();
});

test("확인 단계는 개수를 읽어 주고 초점을 취소에 둔다", async () => {
  const user = userEvent.setup();
  render(
    <BulkComplete
      target={marianaThrough}
      completedIds={new Set()}
      onComplete={vi.fn()}
    />,
  );
  await user.click(action("여기까지 완료"));

  // 방금 누른 버튼이 사라진 자리다 — 초점이 body로 떨어지면 키보드로 확인
  // 단계에 닿을 길이 없다. 실수 방지가 이 단계의 이유이므로 취소가 기본이다
  expect(document.activeElement).toBe(action("취소"));
  // 개수를 듣지 못하면 확인 단계가 없는 것과 같다
  expect(screen.getByRole("status").textContent).toContain("2개가 새로 완료");
});

test("프록시마 고리는 부르는 말만 다르다 — 조작과 확인 단계는 같다", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(
    <BulkComplete
      target={{ kind: "group", id: "Earth_SPACE" }}
      proxima
      completedIds={new Set()}
      onComplete={onComplete}
    />,
  );

  await user.click(action("프록시마 전체 완료"));
  expect(screen.getByText(/이 프록시마와 선행 노드를 포함해/)).toBeTruthy();

  const added = bulkCompletion(starchartProgressGraph, new Set(), {
    kind: "group",
    id: "Earth_SPACE",
  });
  await user.click(action(`${added.size}개 완료`));
  expect([...onComplete.mock.calls[0][0]].sort()).toEqual([...added].sort());
});
