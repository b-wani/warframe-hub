/**
 * 천체 텍스처 카탈로그.
 *
 * 출처는 Solar System Scope(CC BY 4.0) 하나뿐이고, 여기 적힌 파일명이 곧
 * 다운로드 대상이다 — `pnpm fetch:textures`가 이 목록을 읽어 `public/`에
 * 내려받고, 비주얼 표(`bodies.ts`)는 이 목록 밖의 파일을 쓸 수 없다(타입).
 * 목록·내려받은 파일·화면이 어긋날 자리를 없애는 게 이 모듈의 존재 이유다.
 *
 * 라이선스는 출처 표기가 조건이므로 스타차트 페이지에 크레딧을 노출한다
 * (수용 기준 §10-7) — 표기 문구도 여기서 나간다.
 */

/**
 * 쓰는 텍스처 전부. 2K 고정이다 — 모바일도 같은 3D를 돌리므로(스펙 §8) 8K는
 * 쓰지 않는다.
 */
export const TEXTURE_FILES = [
  "2k_stars_milky_way.jpg",
  "2k_sun.jpg",
  "2k_mercury.jpg",
  "2k_venus_atmosphere.jpg",
  "2k_earth_daymap.jpg",
  "2k_moon.jpg",
  "2k_mars.jpg",
  "2k_jupiter.jpg",
  "2k_saturn.jpg",
  "2k_saturn_ring_alpha.png",
  "2k_uranus.jpg",
  "2k_neptune.jpg",
  "2k_ceres_fictional.jpg",
  "2k_eris_fictional.jpg",
  "2k_haumea_fictional.jpg",
  "2k_makemake_fictional.jpg",
] as const;

export type TextureFile = (typeof TEXTURE_FILES)[number];

/** `public/` 아래의 보관 위치. 브라우저가 보는 경로의 접두사이기도 하다. */
export const TEXTURE_DIR = "textures/planets";

export const texturePath = (file: TextureFile): string =>
  `/${TEXTURE_DIR}/${file}`;

/** 내려받을 원본 주소. */
export const textureSourceUrl = (file: TextureFile): string =>
  `https://www.solarsystemscope.com/textures/download/${file}`;

/**
 * CC BY 4.0이 요구하는 출처 표기. 페이지에 그대로 노출한다.
 */
export const TEXTURE_CREDIT = {
  title: "Solar System Scope — Solar Textures",
  url: "https://www.solarsystemscope.com/textures/",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;
