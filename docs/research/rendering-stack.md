# 스타차트 렌더링 스택 리서치

조사일: 2026-08-24. 대상 스펙: [starchart-spec](./starchart-spec.md) — 태양계 뷰↔행성 노드 그래프 뷰 2단 줌 + 시네마틱 카메라 전환, 수백 개 마름모 노드(3상태) 호버/선택, 연결선, 균열 등 실시간 오버레이 심볼, 라벨. 호스트: Next.js 16 App Router + React 19.2.

## 후보 비교

| 기준 | three.js 직접 | react-three-fiber(r3f) v9 + drei | PixiJS (+pixi-react) | deck.gl |
|---|---|---|---|---|
| React 19 / Next 16 호환 | 프레임워크 무관. ref+useEffect로 수동 브릿지 필요 | **v9가 React 19 전용 호환 릴리스** (peerDeps `react >=19 <19.3`). drei v10도 `react ^19`, `@react-three/fiber ^9` | 3D 아님(2D 스프라이트 렌더러) — 태양계/행성 구체 3D 연출에 부적합 | 지리·대용량 데이터 시각화 특화, 시네마틱 3D 씬/커스텀 카메라 연출에 과설계 |
| 카메라 전환·궤도 컨트롤 | 직접 구현 또는 examples/OrbitControls 수동 결선 | drei `OrbitControls`/`CameraControls`(camera-controls 래핑, `setLookAt` 보간으로 시네마틱 줌 전환) 제공 | 2D 카메라(viewport 라이브러리 별도) | 자체 view/transition 있으나 지도용 |
| 수백 노드 인터랙션 | InstancedMesh + Raycaster 수동 관리 | `<Instances>`/`InstancedMesh` + 이벤트 시스템이 instanceId 단위 pointerover/click 제공, drei `Bvh`로 레이캐스팅 가속. 수백 개 규모는 여유 | 2D 히트테스트는 우수 | picking은 GPU 기반이나 노드 그래프 UI엔 부자연 |
| 라벨/오버레이 | CSS2DRenderer 수동 | drei `Html`(DOM 오버레이 툴팁·미리보기 패널), `Text`(troika SDF, 3D 라벨), `Billboard` — 스펙의 호버 미리보기·심볼 오버레이에 그대로 대응 | DOM 병행 필요 | DOM 병행 필요 |
| SSR 회피 | 동일 패턴 필요 | 표준 패턴 확립: 씬 파일에 `'use client'` + `next/dynamic({ ssr: false })` (App Router에선 클라이언트 컴포넌트 내부에서 dynamic 호출) | 동일 | 동일 |
| 번들 크기 | three 코어 ~170KB gzip 수준(트리셰이킹 가능) | three + r3f(~10KB대) + drei는 사용 컴포넌트만 트리셰이킹. dynamic import로 스타차트 라우트에만 로드 | pixi ~100KB+ | deck.gl 수백 KB급 |
| 유지보수 | mrdoob/three.js 월간 릴리스(r185, 2026-07) | pmndrs 활발: fiber 9.7.0(2026-08-11), drei 10.7.8(2026-08-05) | 활발 | 활발 |

출처:
- r3f v9 = React 19 호환 릴리스, 릴리스 노트/마이그레이션 가이드: https://github.com/pmndrs/react-three-fiber/releases , https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- drei React 19 호환 논의(v9/v10에서 해소): https://github.com/pmndrs/drei/issues/2260 , https://github.com/pmndrs/drei/discussions/2213
- peerDependencies 확인: `npm view @react-three/fiber peerDependencies` → `react >=19 <19.3`; `npm view @react-three/drei peerDependencies` → `react ^19`, `@react-three/fiber ^9` (2026-08-24 조회)
- Next.js 통합(`use client` + `dynamic ssr:false`) 및 Bvh 권장: https://threejsresources.com/frameworks/three-js-nextjs , https://github.com/pmndrs/react-three-fiber/discussions/3221 , 공식 스타터 https://github.com/pmndrs/react-three-next
- InstancedMesh 인스턴싱/레이캐스팅(BVH 가속 포함): https://threejs.org/docs/pages/InstancedMesh.html , https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/ , https://discourse.threejs.org/t/three-ez-instancedmesh2-enhanced-instancedmesh-with-frustum-culling-fast-raycasting-bvh-sorting-visibility-management-lod-skinning-and-more/69344
- three.js vs r3f vs Pixi 성격 비교: https://www.creativedevjobs.com/blog/react-three-fiber-vs-threejs , https://appscale.blog/en/blog/pixijs-vs-threejs-web-graphics-engine-comparison-2026 , https://www.pkgpulse.com/guides/threejs-vs-react-three-fiber-vs-babylonjs-3d-webgl-2026

## 탈락 사유 요약

- **three.js 직접**: 가능하지만 React 상태(노드 상태·worldstate 오버레이)와 씬 동기화를 전부 수동 결선해야 하고, r3f가 주는 선언적 이벤트/Suspense 로딩·drei 유틸을 재발명하게 됨.
- **PixiJS**: 2D 전용. 행성 구체·3D 궤도 카메라 연출이 스펙 핵심이라 부적합.
- **deck.gl**: 지오데이터 대량 시각화용. 수백 노드 규모에 과하고 시네마틱 카메라·씬 그래프 표현력이 목적과 안 맞음.

## 최종 권고

**r3f 스택 채택**:

```
three@^0.185.0
@react-three/fiber@^9.7.0
@react-three/drei@^10.7.8
```

구현 가이드:
- 스타차트 라우트에서 `'use client'` 컴포넌트 + `next/dynamic(..., { ssr: false })`로 Canvas 로드(three가 서버 번들·프리렌더에 안 들어가게).
- 카메라: drei `CameraControls`의 `setLookAt(..., true)` 보간으로 성계↔행성 시네마틱 전환.
- 노드: 마름모는 상태별 머티리얼의 `<Instances>` 3그룹(잠김/미클리어/클리어) + instanceId 이벤트로 호버/선택, `<Bvh>`로 레이캐스팅 가속.
- 연결선: `Line`(drei, three-fatline 기반) — 점선(잠김)/실선 구분.
- 라벨·오버레이: 노드명은 drei `Text`/`Billboard`, 호버 미리보기 패널·균열 등 심볼은 drei `Html`(worldstate 데이터를 React 상태로 그대로 바인딩).
