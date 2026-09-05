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

`pnpm e2e`는 서버가 없으면 `pnpm build && pnpm start`부터 돌린다. 반복 실행할
때는 다른 터미널에 서버를 미리 띄워 두면 `reuseExistingServer`가 그 서버를
재사용해 매번의 빌드를 건너뛴다:

```bash
pnpm build && pnpm start   # 터미널 1 — 코드를 고치면 다시 빌드한다
pnpm e2e                   # 터미널 2 — 빌드 없이 바로 돈다
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

## 천체 텍스처 (한 번 받아서 커밋)

성계 뷰의 행성 텍스처는 [Solar System Scope](https://www.solarsystemscope.com/textures/)의
2K 이미지(CC BY 4.0)를 `public/textures/planets/`에 커밋해서 쓴다 — 배포본이 외부
사이트의 생존에 매달리지 않게 하려는 것이다. 받을 목록은 텍스처 카탈로그
(`src/starchart/textures.ts`)가 유일한 원본이고, 라이선스 조건인 출처 표기는
스타차트 페이지에 있다.

```bash
pnpm fetch:textures          # 없는 것만 받는다
pnpm fetch:textures --check  # 받지 않고 빠진 파일만 알려준다
pnpm fetch:textures --force  # 이미 있는 것도 다시 받는다
```

카탈로그에 파일을 추가했을 때만 다시 돌린다.

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

GitHub Actions(`.github/workflows/ci.yml`)가 두 잡으로 돈다. `check`(lint → typecheck →
단위 테스트)가 먼저, 통과하면 `e2e`가 이어진다. PR에서는 `@smoke` 태그가 붙은 e2e만
돌고(다른 층에서 볼 수 없는 것 — WebGL 기동·폴백 전환·카메라 연속 비행·브라우저 고유
동작), `main` 푸시에서는 전부 돈다. 하나라도 실패하면 워크플로가 실패한다.

e2e는 기본으로 모션 감소(`contextOptions.reducedMotion: "reduce"`) 상태에서 돈다 — 앱이
`prefers-reduced-motion`을 따라 카메라 비행을 건너뛰므로 테스트가 비행이 멈추기를
기다리지 않는다. 비행 자체를 검증하는 테스트만 `test.use({ contextOptions: { reducedMotion: "no-preference" } })`로
되돌린다. 로컬에서 smoke만 돌리려면:

```bash
pnpm e2e --grep @smoke
```

## 배포 (Vercel)

Vercel의 GitHub 연동으로 배포한다. 최초 1회 설정:

1. [vercel.com/new](https://vercel.com/new)에서 `b-wani/warframe-hub` 저장소를 import한다.
2. Framework Preset이 **Next.js**로 자동 감지되는지 확인하고 나머지는 기본값으로 Deploy.

이후에는 `main`에 머지될 때마다 프로덕션 URL로 자동 배포되고, PR마다 프리뷰 URL이 생성된다.
