"use client";

/**
 * 진행도 가져오기의 진입점을 한자리에 모은 곳 (스펙 §5).
 *
 * 툴바·온보딩 배너·위저드는 서로 다른 조각이지만 여는 조건이 하나로 묶여 있다 —
 * 배너는 완료 집합이 비어 있고 아직 닫지 않았을 때만, 위저드는 둘 중 어느 쪽을
 * 눌러도. 그 조건을 3D 장면이 들고 있으면 WebGL 없이는 확인할 수 없으므로 여기
 * DOM 컴포넌트로 떼어 둔다.
 *
 * 완료 집합은 이 컴포넌트의 것이 아니다 — 받아서 읽고, 바꾸는 것은 위로 알린다.
 */
import { useState } from "react";
import {
  createLocalStorageOnboardingRepository,
  type OnboardingRepository,
} from "@/starchart/onboarding-repository";
import { ImportOnboardingBanner } from "./import-banner";
import { ImportWizard } from "./import-wizard";
import { ProgressToolbar } from "./progress-toolbar";
import styles from "./page.module.css";

export function ProgressControls({
  completedIds,
  knownNodeIds,
  onImport,
  onReset,
  onboarding,
}: {
  completedIds: ReadonlySet<string>;
  knownNodeIds: ReadonlySet<string>;
  onImport: (nodeIds: readonly string[]) => void;
  onReset: () => void;
  /** 배너 해제 기록의 저장소. 기본값은 로컬스토리지다. */
  onboarding?: OnboardingRepository;
}) {
  // 저장소도 해제 여부도 첫 렌더에 한 번만 정한다 — 로컬스토리지는 서버에 없다
  const [store] = useState(
    () => onboarding ?? createLocalStorageOnboardingRepository(),
  );
  const [dismissed, setDismissed] = useState(() => store.isDismissed());
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className={styles.progressHud}>
      <ProgressToolbar
        completedCount={completedIds.size}
        onImport={() => setWizardOpen(true)}
        onReset={onReset}
      />

      {completedIds.size === 0 && !dismissed && (
        <ImportOnboardingBanner
          onStart={() => setWizardOpen(true)}
          onDismiss={() => {
            store.dismiss();
            setDismissed(true);
          }}
        />
      )}

      {wizardOpen && (
        <ImportWizard
          completedIds={completedIds}
          knownNodeIds={knownNodeIds}
          onImport={onImport}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
