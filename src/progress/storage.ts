import { z } from "zod";

export const PROGRESS_STORAGE_KEY = "warframe-hub:progress";

// 2단계 계정 동기화 시 로컬→서버 마이그레이션을 전제로 버전을 명시한다
const storedProgressSchema = z.object({
  version: z.literal(1),
  completedNodeIds: z.array(z.string()),
});

/** localStorage에 저장된 진행 상태를 복원한다. 없거나 손상됐거나 모르는 버전이면 빈 집합. */
export function loadProgress(): Set<string> {
  const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (raw === null) return new Set();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set();
  }

  const result = storedProgressSchema.safeParse(parsed);
  if (!result.success) return new Set();
  return new Set(result.data.completedNodeIds);
}

/** 완료 집합을 버전 필드와 함께 localStorage에 저장한다. */
export function saveProgress(completedIds: ReadonlySet<string>): void {
  localStorage.setItem(
    PROGRESS_STORAGE_KEY,
    JSON.stringify({ version: 1, completedNodeIds: [...completedIds] }),
  );
}
