"use client";

/**
 * 진행도 가져오기 2단계 위저드 (스펙 §5).
 *
 * 1단계는 계정 ID만 받는다 — URL은 앱이 조립해 새 탭으로 열어 준다. 사용자가
 * 비문서화 엔드포인트의 주소를 손으로 짜맞추게 두지 않는다.
 * 2단계는 붙여넣기 하나다. 파싱은 도메인(`profile-import`)이 하고 이 화면은
 * 결과 네 갈래를 각각의 문구로 옮길 뿐이다 — 무엇이 잘못됐는지 사용자가 알아야
 * 다음 행동이 정해진다.
 *
 * 반영은 언제나 미리보기를 거친다. 미리보기의 숫자와 실제 병합은 같은 계산이고,
 * 병합은 합집합이라 완료가 지워지는 경우가 없다 — 그래서 되돌리기가 없어도 된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCOUNT_ID_GUIDE_URL,
  accountIdFrom,
  importPreview,
  parseProfileImport,
  profileUrl,
  type ProfileImport,
} from "@/starchart/profile-import";
import styles from "./page.module.css";

type Step = "account" | "paste";

export function ImportWizard({
  completedIds,
  knownNodeIds,
  onImport,
  onClose,
}: {
  /** 지금의 완료 집합 — 미리보기의 "기존 K개 유지"가 여기서 나온다. */
  completedIds: ReadonlySet<string>;
  /** 데이터셋이 아는 노드 id — 그 밖의 `Tag`는 전부 버린다. */
  knownNodeIds: ReadonlySet<string>;
  /** 합집합 병합. 미리보기에서 확정을 누른 뒤에만 불린다. */
  onImport: (nodeIds: readonly string[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("account");
  const [accountId, setAccountId] = useState("");
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<ProfileImport | null>(null);
  /** URL을 붙여넣어 1단계로 되돌아왔다는 알림 — 되돌림은 오류가 아니다. */
  const [returnedFromUrl, setReturnedFromUrl] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  // 열리면 모달 안으로 초점을 옮긴다 — 키보드만으로도 1단계에 바로 닿아야 한다
  useEffect(() => {
    dialog.current?.querySelector("input")?.focus();
  }, []);

  const submit = useCallback(() => {
    const parsed = parseProfileImport(pasted, knownNodeIds);
    if (parsed.kind === "url") {
      // 관대한 파서 — URL이 들어오면 1단계로 되돌린다(스펙 §5)
      if (parsed.accountId) setAccountId(parsed.accountId);
      setPasted("");
      setResult(null);
      setReturnedFromUrl(true);
      setStep("account");
      return;
    }
    setResult(parsed);
  }, [knownNodeIds, pasted]);

  const openProfile = useCallback(() => {
    const id = accountIdFrom(accountId);
    if (id === null) return;
    window.open(profileUrl(id), "_blank", "noopener,noreferrer");
    setReturnedFromUrl(false);
    setStep("paste");
  }, [accountId]);

  return (
    <div
      className={styles.modalBackdrop}
      // 바깥을 눌러 닫는 길. 3D 캔버스가 이 클릭을 받아 카메라가 움직이지 않게
      // 모달이 화면 전체를 덮는다.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-wizard-title"
        // ESC는 모달만 닫는다 — 뒤의 지도가 함께 성계 뷰로 물러나면 안 된다
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
      >
        <header className={styles.modalHead}>
          <h2 id="import-wizard-title" className={styles.modalTitle}>
            진행도 가져오기
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {step === "account" ? (
          <AccountStep
            accountId={accountId}
            returnedFromUrl={returnedFromUrl}
            onChange={(value) => {
              setAccountId(value);
              setReturnedFromUrl(false);
            }}
            onOpenProfile={openProfile}
            onSkip={() => {
              setReturnedFromUrl(false);
              setStep("paste");
            }}
          />
        ) : (
          <PasteStep
            pasted={pasted}
            result={result}
            completedIds={completedIds}
            onChange={(value) => {
              setPasted(value);
              setResult(null);
            }}
            onSubmit={submit}
            onBack={() => {
              setResult(null);
              setStep("account");
            }}
            onConfirm={(nodeIds) => {
              onImport(nodeIds);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function AccountStep({
  accountId,
  returnedFromUrl,
  onChange,
  onOpenProfile,
  onSkip,
}: {
  accountId: string;
  returnedFromUrl: boolean;
  onChange: (value: string) => void;
  onOpenProfile: () => void;
  onSkip: () => void;
}) {
  return (
    <div className={styles.modalBody}>
      <p className={styles.stepMark}>1 / 2 단계</p>
      {returnedFromUrl && (
        <p className={styles.notice} role="alert">
          붙여넣은 것이 JSON이 아니라 주소입니다. 아래 버튼으로 프로필을 연 뒤,
          그 페이지에 뜬 내용 전체를 복사해 붙여넣어 주세요.
        </p>
      )}
      <p className={styles.modalText}>
        계정 ID를 넣으면 프로필 주소를 대신 만들어 새 탭으로 엽니다.
      </p>

      <label className={styles.field}>
        <span>계정 ID</span>
        <input
          type="text"
          value={accountId}
          spellCheck={false}
          autoComplete="off"
          placeholder="예: 5f2b9c1d3e4a5b6c7d8e9f01"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpenProfile();
          }}
        />
      </label>

      <details className={styles.guide}>
        <summary>계정 ID는 어디서 확인하나요?</summary>
        <ol>
          <li>게임을 실행한 뒤 프로필 화면에서 프로필 링크를 복사합니다.</li>
          <li>
            복사한 주소 끝의 긴 16진수 문자열이 계정 ID입니다 (닉네임으로는 조회할
            수 없습니다 — 업데이트 38.0.8에서 제거됐습니다).
          </li>
          <li>
            잘 안 되면 원본 안내를 따라가세요:{" "}
            <a
              href={ACCOUNT_ID_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              FrameHub 계정 ID 안내
            </a>
          </li>
        </ol>
      </details>

      <div className={styles.modalActions}>
        <button type="button" className={styles.ghostButton} onClick={onSkip}>
          이미 복사했어요
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onOpenProfile}
          disabled={accountIdFrom(accountId) === null}
        >
          프로필 열기
        </button>
      </div>
    </div>
  );
}

function PasteStep({
  pasted,
  result,
  completedIds,
  onChange,
  onSubmit,
  onBack,
  onConfirm,
}: {
  pasted: string;
  result: ProfileImport | null;
  completedIds: ReadonlySet<string>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onConfirm: (nodeIds: readonly string[]) => void;
}) {
  const preview =
    result?.kind === "ready"
      ? importPreview(result.nodeIds, completedIds)
      : null;

  return (
    <div className={styles.modalBody}>
      <p className={styles.stepMark}>2 / 2 단계</p>
      <p className={styles.modalText}>
        새 탭에 뜬 프로필 내용을 전부 복사해 붙여넣어 주세요.
      </p>

      <label className={styles.field}>
        <span>프로필 JSON</span>
        <textarea
          value={pasted}
          rows={5}
          spellCheck={false}
          placeholder='{"Results":[{"Missions":[...]}]}'
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      {result !== null && result.kind !== "ready" && (
        <p className={styles.error} role="alert">
          <ErrorMessage result={result} />
        </p>
      )}

      {result?.kind === "ready" && preview && (
        <div className={styles.preview}>
          <p>
            노드 {preview.recognized}개 인식, {preview.added}개 새로 추가,
            기존 {preview.kept}개 유지
          </p>
          {result.steelPathIgnored > 0 && (
            <p className={styles.previewNote}>
              스틸패스 기록은 v1에서 다루지 않습니다 (
              {result.steelPathIgnored}건 무시).
            </p>
          )}
        </div>
      )}

      <div className={styles.modalActions}>
        <button type="button" className={styles.ghostButton} onClick={onBack}>
          ← 계정 ID로
        </button>
        {result?.kind === "ready" ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => onConfirm(result.nodeIds)}
          >
            진행도에 반영
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onSubmit}
            disabled={pasted.trim() === ""}
          >
            확인
          </button>
        )}
      </div>
    </div>
  );
}

/** 오류 4구분의 문구 (스펙 §5) — 각각이 사용자에게 다른 다음 행동을 준다. */
function ErrorMessage({ result }: { result: ProfileImport }) {
  switch (result.kind) {
    case "invalid-json":
      return (
        <>JSON으로 읽을 수 없습니다. 페이지 내용 전체를 복사했는지 확인해 주세요.</>
      );
    case "not-profile":
      return (
        <>
          프로필 데이터가 아닙니다 — 다른 페이지를 복사했거나 프로필이 비공개일 수
          있습니다.
        </>
      );
    case "no-known-nodes":
      return (
        <>
          클리어 기록은 있는데 아는 노드가 하나도 없습니다. 우리 쪽 문제일 수
          있으니 제보해 주세요.
        </>
      );
    default:
      return null;
  }
}
