# 워프레임 허브

한국 워프레임 뉴비 허브 — 진행 트래커를 코어로 하는 Next.js 웹 서비스.

## 요구사항

- Node.js 24+
- pnpm 10+ (`corepack enable` 또는 직접 설치)

## 로컬 실행

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## 테스트

```bash
pnpm lint       # ESLint
pnpm typecheck  # tsc --noEmit
pnpm test       # 단위 테스트 (Vitest)
pnpm e2e        # E2E 테스트 (Playwright — 프로덕션 빌드를 띄워서 검사)
```

Playwright를 처음 실행하기 전에 브라우저를 설치한다:

```bash
pnpm exec playwright install chromium
```

## 스타차트 데이터 (수동 실행 루틴)

게임 패치 때 운영자가 직접 돌리고 diff를 검수한다. 스크립트는 Node 24의 TypeScript
직접 실행에 기댄다 (별도 빌드 없음).

```bash
pnpm build:starchart              # 정제 노드 데이터셋 (업스트림 → src/data/starchart.json)
pnpm build:starchart-layout       # 좌표 데이터셋 — 빠진 좌표만 채운다 (수동 보정 보존)
pnpm build:starchart-layout --check  # 파일을 쓰지 않고 검증만
```

좌표 보정은 `src/data/starchart-layout.json`을 에디터에서 직접 고치는 워크플로다 —
[좌표 데이터셋 생성·보정](docs/starchart-layout-workflow.md) 참고.

## 링크 생존 점검 (운영 루틴)

출처 등록부(`sources/README.md`)와 페이지 크레딧(`src/data/sources.json`)에 적힌
URL이 아직 살아 있는지 점검하고 죽은 링크 목록을 만든다. 외부 사이트를 실제로
호출하므로 CI에서는 돌리지 않고, 운영자가 주기적으로(콘텐츠 갱신 전후) 직접 돌린다.
스크립트는 Node 24의 TypeScript 직접 실행에 기댄다 (별도 빌드 없음).

```bash
pnpm check:links                      # 리포트를 화면으로
pnpm check:links --out=link-report.md # 리포트를 파일로
```

등록부에 `alive`로 적혀 있는데 실제로 죽은 링크가 있으면 종료 코드 1로 끝난다
(등록부와 `src/data/sources.json`을 갱신해야 한다는 신호).

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `WORLDSTATE_API_BASE` | `https://api.warframestat.us/pc` | 월드스테이트 API 베이스 URL. 장애 시뮬레이션·목 서버로 바꿀 때 쓴다. |
| `NEXT_PUBLIC_SITE_URL` | `https://warframe-hub.vercel.app` (Vercel 프리뷰는 `VERCEL_URL`) | 절대 URL의 기준. OG 이미지·사이트맵·robots.txt가 쓴다. 커스텀 도메인을 붙이면 여기에 넣는다. |

## CI

`main` 푸시와 모든 PR에서 GitHub Actions(`.github/workflows/ci.yml`)가 lint → typecheck → 단위 테스트 → E2E를 실행한다. 하나라도 실패하면 워크플로가 실패한다.

## 배포 (Vercel)

Vercel의 GitHub 연동으로 배포한다. 최초 1회 설정:

1. [vercel.com/new](https://vercel.com/new)에서 `b-wani/warframe-hub` 저장소를 import한다.
2. Framework Preset이 **Next.js**로 자동 감지되는지 확인하고 나머지는 기본값으로 Deploy.

이후에는 `main`에 머지될 때마다 프로덕션 URL로 자동 배포되고, PR마다 프리뷰 URL이 생성된다.
