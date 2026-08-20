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

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `WORLDSTATE_API_BASE` | `https://api.warframestat.us/pc` | 월드스테이트 API 베이스 URL. 장애 시뮬레이션·목 서버로 바꿀 때 쓴다. |

## CI

`main` 푸시와 모든 PR에서 GitHub Actions(`.github/workflows/ci.yml`)가 lint → typecheck → 단위 테스트 → E2E를 실행한다. 하나라도 실패하면 워크플로가 실패한다.

## 배포 (Vercel)

Vercel의 GitHub 연동으로 배포한다. 최초 1회 설정:

1. [vercel.com/new](https://vercel.com/new)에서 `b-wani/warframe-hub` 저장소를 import한다.
2. Framework Preset이 **Next.js**로 자동 감지되는지 확인하고 나머지는 기본값으로 Deploy.

이후에는 `main`에 머지될 때마다 프로덕션 URL로 자동 배포되고, PR마다 프리뷰 URL이 생성된다.
