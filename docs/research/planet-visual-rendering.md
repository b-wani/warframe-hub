# 리서치: 성계지도 행성 비주얼 렌더링 (three@^0.185 + @react-three/fiber@^9.7)

- 이슈: [#31](https://github.com/b-wani/warframe-hub/issues/31)
- 작성일: 2026-08-25
- 질문: 워프레임 성계지도 웹 재현에서 행성을 WebGL(three/R3F)로 어떻게 표현할지 — 기법 스펙트럼, 선행 사례, 에셋/라이선스, v1 권고

## 1. three.js/R3F 행성 렌더링 기법 스펙트럼

난이도·비용 오름차순.

### (a) 텍스처 구체 (가장 저비용)
`SphereGeometry` + `MeshStandardMaterial`(map, 필요시 normal/emissive) 하나면 끝. R3F에서는 `useTexture`(drei)로 로드. 행성당 드로우콜 1, 어떤 GPU에서도 문제 없음.
- three.js 재질/텍스처 API: https://threejs.org/docs/ (`MeshStandardMaterial`, `SphereGeometry`)
- drei `useTexture`: https://drei.docs.pmnd.rs/loaders/texture-use-texture

### (b) 대기(atmosphere/fresnel) 림 글로우
두 가지 정석 패턴:
1. **프레넬 림**: `dot(normal, viewDir)` 기반으로 가장자리를 밝히는 커스텀 셰이더(drei `shaderMaterial` 또는 three `ShaderMaterial`). 행성 메시 자체에 얹거나,
2. **백페이스 대기 셸**: 행성보다 약간 큰 구체를 `side: BackSide` + additive blending으로 겹침.
- three.js 공식 예제 (Earth, WebGPU/TSL이지만 기법 동일 — day/night dot product, fresnel, 백페이스 대기): https://threejs.org/examples/webgpu_tsl_earth.html
- R3F 프레넬 재질 예: https://github.com/otanodesignco/Fresnel-Shader-Material (MIT)
- R3F 커스텀 셰이더로 행성+프레넬 만드는 튜토리얼: https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber/
- 셰이더 기반 Earth 상세 워크스루: https://sangillee.com/2024-06-07-create-realistic-earth-with-shaders/
비용: 행성당 +1 드로우콜(셸 방식) 또는 0(림 방식). 프래그먼트 셰이더 몇 줄 수준.

### (c) 구름 레이어
행성 반경 ×1.005 정도의 두 번째 구체에 구름 텍스처(알파) + 느린 자전. three.js 공식 Earth 예제는 구름을 별도 채널에 패킹해 메모리를 아끼는 것까지 시연. 비용: 행성당 +1 드로우콜 + 텍스처 1장.

### (d) 행성 링 (토성 등)
`RingGeometry` + 반투명 텍스처. UV가 방사형이 아니라서 링 텍스처는 UV 보정(정점 셰이더 또는 지오메트리 UV 재작성)이 필요하다는 것이 잘 알려진 함정. 비용 미미.

### (e) 프로시저럴/스타일라이즈드 행성
텍스처 없이 노이즈 기반 프래그먼트 셰이더로 색·지형을 생성. 워프레임처럼 "실제와 다른 룩"을 만들 때 텍스처 소싱 문제를 우회할 수 있음.
- 프로시저럴 행성 (three.js, 데모 포함): https://github.com/dgreenheck/threejs-procedural-planets
- 프로시저럴 equirectangular 행성 텍스처 생성기: https://boytchev.github.io/texture-generator/docs/planet.html / TSL판 https://github.com/boytchev/tsl-textures
비용: 텍스처 로딩 0이지만 프래그먼트 셰이더가 무겁고 룩 튜닝 공수가 큼.

### (f) 풀 정밀 대기 산란 (과잉)
Bruneton 사전계산 산란의 three/R3F 구현체가 존재하나(https://www.npmjs.com/package/@takram/three-atmosphere), 지표면 근접 뷰용. 궤도에서 내려다보는 성계지도에는 (b)의 프레넬로 충분.

### 성능 일반론
행성 ~18개(워프레임 성계) + 노드 마커 수백 개 규모는 WebGL에 전혀 부담이 아님. EVE Frontier 맵은 three.js로 20만 성계를 렌더한 사례를 문서화함: https://ef-map.com/blog/threejs-rendering-3d-starfield — 우리 규모에서는 인스턴싱조차 필요 없고, 텍스처 해상도(2K면 충분)와 대기 셸 오버드로우만 관리하면 됨.

## 2. 선행 사례

### 워프레임 성계지도 웹 재현
- **shiftygames/warframe-app star chart** (https://shiftygames.github.io/warframe-app/star-chart/): 현재 텍스트 목록 수준, 비주얼 렌더링 없음(공사중). 참고 가치 낮음.
- **warframe-tools** (https://github.com/warframe-tools/warframe-tools.github.io): 유틸 모음, 성계지도 3D 재현 없음.
- 결론: **인게임 룩을 3D로 재현한 오픈소스 선례는 사실상 없음** — 이 프로젝트가 만들면 첫 사례에 가까움. 인게임 레퍼런스는 공식 소개(https://www.warframe.com/en/news/star-chart)와 위키(https://wiki.warframe.com/w/Star_Chart)가 기준: 3D 공간의 행성 디오라마 + 줌인 시 노드/정션 그래프.

### 유사 장르 스타맵
- EVE Online 맵 (three.js): https://github.com/fuzzysteve/ThreeJs-starmap , https://github.com/omgnull/evemap — 성계를 **포인트/스프라이트**로 그리고 행성 디테일은 생략. 노드-그래프 시각화에 집중.
- Star Citizen WebGL 맵: https://github.com/Leeft/Star-Citizen-WebGL-Map — 동일하게 심볼 위주.
- 시사점: 스타맵 장르의 관례는 "행성=아이콘/포인트"지만, 워프레임 성계지도는 행성 자체가 큼직한 히어로 비주얼이라 (a)+(b) 수준의 실제 구체 렌더가 차별점.

## 3. 텍스처·에셋 소스와 라이선스

| 소스 | 라이선스 | 비고 |
|---|---|---|
| Solar System Scope textures (https://www.solarsystemscope.com/textures/) | **CC BY 4.0** (상업 사용·개작 허용, 출처 표기) | NASA 데이터 기반, 2K/8K equirectangular. three.js 공식 Earth 예제도 사용. Qt 문서·Wikimedia Commons에서 라이선스 교차 확인됨 (https://doc.qt.io/qt-6/qt3d-attribution-solar-system-scope.html) |
| NASA 원본 이미지 | 대부분 퍼블릭 도메인 | 가공 필요 |
| 프로시저럴 생성 (boytchev texture-generator, MIT) | MIT | 인게임 룩 커스텀에 유리 |

### 인게임 룩 재현 가능성
워프레임 행성은 이름만 실제 태양계와 같고 비주얼은 로어 기반(지구=인페스티드 숲, 금성=빙결+코퍼스, 데이모스=인페스티드 등 — 위키 확인). 따라서:
- 실사 텍스처(CC BY)를 그대로 쓰면 "태양계 지도"는 되지만 "워프레임 룩"은 아님.
- 인게임 텍스처 추출·사용은 Digital Extremes 저작물이라 **라이선스상 불가** 전제.
- 현실적 절충: **실사 CC BY 텍스처를 베이스로 + 행성별 색보정(tint)·대기색·이미시브를 셰이더 유니폼으로 오버라이드**해 "지구=녹색 대기, 금성=한랭 청백색" 식의 무드만 인게임에 맞춤. 완전 재현이 필요하면 (e) 프로시저럴로 행성별 팔레트를 설계.

## 4. v1 권고

**권고 수준: (a)+(b) — 텍스처 구체 + 프레넬 대기 셸 + 행성별 색 오버라이드. 링은 토성 등 해당 행성만 (d). 구름 (c)과 프로시저럴 (e)는 v2 이후.**

근거:
1. 구현 공수가 작고(drei `useTexture` + 짧은 커스텀 셰이더 1개) three.js 공식 Earth 예제라는 1차 레퍼런스가 그대로 있음.
2. 행성 ~18개 규모에서 성능 리스크 없음 (드로우콜 행성당 2, 2K 텍스처).
3. Solar System Scope CC BY 4.0으로 라이선스가 깨끗함 — 푸터/크레딧 페이지에 출처 표기만 추가.
4. 워프레임 고유 룩은 tint/대기색 유니폼으로 행성별 무드만 입히는 선에서 v1 타협 — 완전한 인게임 재현은 프로시저럴 텍스처 설계가 필요한 v2 과제.

리스크/후속:
- 링 텍스처 UV 보정은 토성 구현 시 별도 확인.
- 모바일에서 8K 텍스처 금지(2K 고정), 대기 셸 additive blending 오버드로우는 행성 1개씩만 화면에 크게 나오는 구도라 무시 가능.
