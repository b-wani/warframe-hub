/**
 * 성계 뷰가 그리는 천체의 표시 모델.
 *
 * 화면이 알아야 하는 것 — 어떤 천체를 어디에 얼마나 크게, 어떤 텍스처·색으로
 * 그릴지 — 를 한 번에 계산해서 넘긴다. 씬 컴포넌트는 그룹 유형이나 좌표계,
 * 행성별 무드 색을 몰라도 된다.
 *
 * 세 갈래의 사실을 합친다:
 * - 정제 노드 데이터셋 — 어떤 그룹이 있고 표시명이 무엇인가
 * - 좌표 데이터셋 — 천체가 성계 뷰의 어디에 놓이는가
 * - 이 파일의 비주얼 표 — 어떤 텍스처·색·크기로 보이는가
 *
 * 성계 뷰에 놓이는 것은 행성/위성 17 + 특수 구역 5뿐이다(스펙 §2.1). 프록시마는
 * 독립 천체가 아니라 해당 행성에 종속 표시하고, 릴레이는 지도에서 숨긴다.
 *
 * 비주얼은 텍스처 구체 + 프레넬 대기 셸 + 행성별 tint 오버라이드다(#31 채택안).
 * 텍스처는 실제 태양계 사진 기반이라 그대로 쓰면 워프레임 룩이 아니므로, 인게임
 * 무드(지구=인페스티드 숲, 금성=빙결, 데이모스=인페스티드 …)를 tint와 대기색으로
 * 입힌다. 실사 텍스처가 없는 천체(위성 일부·특수 구역)는 SSS의 가상 천체 텍스처를
 * 돌려쓰고 tint로 구별한다 — 완전한 인게임 재현은 프로시저럴이 필요한 v2 과제다.
 */
import { isCelestialBodyGroup, type StarchartDataset } from "./dataset.ts";
import type { StarchartLayout } from "./layout.ts";
import { type TextureFile } from "./textures.ts";

/** 좌표 데이터셋의 픽셀을 3D 월드 단위로 옮기는 배율. */
export const WORLD_SCALE = 0.05;

/** 대기 셸이 지표면보다 부풀어 오르는 비율. */
const SHELL_SCALE = 1.2;

/** 라벨이 대기 셸 바깥으로 더 내려가는 거리. */
const LABEL_DROP = 0.6;

/** 태양 — 데이터셋의 그룹이 아니라 성계 뷰의 원점에 놓이는 광원이다. */
export const SUN = {
  radius: 4.5,
  texture: "2k_sun.jpg" satisfies TextureFile,
} as const;

/** 별 배경 — 태양계 밖을 채운다. */
export const STARFIELD_TEXTURE = "2k_stars_milky_way.jpg" satisfies TextureFile;

type Appearance = {
  /** 지표면 텍스처. */
  texture: TextureFile;
  /** 텍스처에 곱해 인게임 무드를 입히는 색. */
  tint: string;
  /** 프레넬 대기 셸의 색. */
  atmosphere: string;
  /** 월드 단위 반지름. */
  radius: number;
  /** 링이 있는 천체만. 반지름은 자기 반지름의 배수다. */
  ring?: { texture: TextureFile; inner: number; outer: number };
};

/**
 * 천체별 비주얼. 성계 뷰에 놓이는 22개를 빠짐없이 덮어야 하며, 게임 패치로
 * 그룹이 늘거나 줄면 `solarSystemBodies`가 문제로 알린다.
 */
const APPEARANCE: Record<string, Appearance> = {
  // 행성/위성 17
  Mercury: {
    texture: "2k_mercury.jpg",
    tint: "#b6a08a",
    atmosphere: "#6b5a48",
    radius: 1.0,
  },
  Venus: {
    texture: "2k_venus_atmosphere.jpg",
    tint: "#cfe4f2",
    atmosphere: "#7fb6e6",
    radius: 1.25,
  },
  Earth: {
    texture: "2k_earth_daymap.jpg",
    tint: "#9dc98a",
    atmosphere: "#57b46a",
    radius: 1.3,
  },
  Moon: {
    texture: "2k_moon.jpg",
    tint: "#e8e2d0",
    atmosphere: "#8f8a76",
    radius: 0.65,
  },
  Mars: {
    texture: "2k_mars.jpg",
    tint: "#e0a878",
    atmosphere: "#d3763a",
    radius: 1.2,
  },
  Phobos: {
    texture: "2k_ceres_fictional.jpg",
    tint: "#c2a58c",
    atmosphere: "#7a6250",
    radius: 0.55,
  },
  SolarMapDeimosName: {
    texture: "2k_haumea_fictional.jpg",
    tint: "#c9c07a",
    atmosphere: "#9aa04a",
    radius: 0.6,
  },
  Ceres: {
    texture: "2k_ceres_fictional.jpg",
    tint: "#cfa47e",
    atmosphere: "#a06a3c",
    radius: 1.0,
  },
  Jupiter: {
    texture: "2k_jupiter.jpg",
    tint: "#e2d3b6",
    atmosphere: "#d9a45c",
    radius: 1.9,
  },
  Europa: {
    texture: "2k_eris_fictional.jpg",
    tint: "#cfe7f5",
    atmosphere: "#7fd0f0",
    radius: 0.7,
  },
  Saturn: {
    texture: "2k_saturn.jpg",
    tint: "#e6d5ad",
    atmosphere: "#d9bc6a",
    radius: 1.9,
    ring: { texture: "2k_saturn_ring_alpha.png", inner: 1.3, outer: 2.3 },
  },
  Uranus: {
    texture: "2k_uranus.jpg",
    tint: "#b6e6e0",
    atmosphere: "#56d6cc",
    radius: 1.55,
  },
  Neptune: {
    texture: "2k_neptune.jpg",
    tint: "#a8c6ea",
    atmosphere: "#4a7fe0",
    radius: 1.5,
  },
  // 명왕성은 SSS에 실사 텍스처가 없다 — 같은 왜소행성 가상 텍스처를 돌려쓴다
  Pluto: {
    texture: "2k_makemake_fictional.jpg",
    tint: "#dcd0c4",
    atmosphere: "#a99a8a",
    radius: 1.05,
  },
  Eris: {
    texture: "2k_eris_fictional.jpg",
    tint: "#b8c98a",
    atmosphere: "#8fae5a",
    radius: 1.05,
  },
  Sedna: {
    texture: "2k_makemake_fictional.jpg",
    tint: "#d99a86",
    atmosphere: "#d05a44",
    radius: 1.1,
  },
  TauRegion: {
    texture: "2k_haumea_fictional.jpg",
    tint: "#d8a0c8",
    atmosphere: "#c060b0",
    radius: 1.4,
  },
  // 특수 구역 5
  Void: {
    texture: "2k_eris_fictional.jpg",
    tint: "#f0d99a",
    atmosphere: "#ffd166",
    radius: 1.3,
  },
  Fortress: {
    texture: "2k_ceres_fictional.jpg",
    tint: "#c07a70",
    atmosphere: "#d0503c",
    radius: 1.0,
  },
  ZarimanRegionName: {
    texture: "2k_makemake_fictional.jpg",
    tint: "#e0cfa8",
    atmosphere: "#e0c070",
    radius: 0.95,
  },
  Duviri: {
    texture: "2k_haumea_fictional.jpg",
    tint: "#e0a8c0",
    atmosphere: "#ff7fbf",
    radius: 1.3,
  },
  "1999MapName": {
    texture: "2k_earth_daymap.jpg",
    tint: "#b9c6d4",
    atmosphere: "#7f9fd0",
    radius: 1.15,
  },
};

export type SolarSystemBody = {
  id: string;
  /** 표시명 — 정제 노드 데이터셋의 것을 그대로 쓴다. */
  name: string;
  /** 태양을 원점으로 한 3D 위치. 황도면(y=0) 위에 놓인다. */
  position: [number, number, number];
  radius: number;
  /** 대기 셸의 반지름. */
  shellRadius: number;
  /**
   * 표시명 라벨이 놓이는 높이(음수 — 천체 아래다). 천체가 화면에서 차지하는
   * 아래쪽 끝이기도 해서, 카메라 프레이밍이 이 값을 여유로 쓴다.
   */
  labelY: number;
  /**
   * 가장 가까운 다른 천체까지의 거리. 탭 히트 영역을 얼마나 키울 수 있는지가
   * 여기서 나온다 — 이웃의 중심까지 삼키면 그 이웃을 못 누른다(`tap-target.ts`).
   */
  spacing: number;
  texture: TextureFile;
  tint: string;
  atmosphere: string;
  /** 월드 단위로 환산한 링 반지름. 링이 없는 천체는 없다. */
  ring?: { texture: TextureFile; inner: number; outer: number };
};

/**
 * 성계 뷰가 그릴 천체를 데이터셋 순서대로 계산한다.
 *
 * 좌표가 없는 천체나 비주얼 표에 없는 천체는 그리지 않고 `issues`로 알린다 —
 * 게임 패치로 그룹이 바뀌면 화면이 조용히 빠뜨리는 대신 CI에서 드러나야 한다.
 */
export function solarSystemBodies(
  dataset: StarchartDataset,
  layout: StarchartLayout,
): { bodies: SolarSystemBody[]; issues: string[] } {
  const bodies: SolarSystemBody[] = [];
  const issues: string[] = [];

  for (const [id, group] of Object.entries(dataset.groups)) {
    if (!isCelestialBodyGroup(group)) continue;

    const point = layout.groups[id];
    if (!point) {
      issues.push(`천체 "${id}"의 좌표가 없다 (좌표 데이터셋을 다시 생성해야 한다)`);
      continue;
    }
    const appearance = APPEARANCE[id];
    if (!appearance) {
      issues.push(
        `천체 "${id}"의 비주얼이 없다 (src/starchart/bodies.ts의 비주얼 표에 추가해야 한다)`,
      );
      continue;
    }

    bodies.push({
      id,
      name: group.name,
      position: [point.x * WORLD_SCALE, 0, point.y * WORLD_SCALE],
      radius: appearance.radius,
      shellRadius: appearance.radius * SHELL_SCALE,
      labelY: -(appearance.radius * SHELL_SCALE + LABEL_DROP),
      // 이웃이 다 모인 뒤에야 알 수 있다 — 아래에서 채운다
      spacing: Infinity,
      texture: appearance.texture,
      tint: appearance.tint,
      atmosphere: appearance.atmosphere,
      ...(appearance.ring && {
        ring: {
          texture: appearance.ring.texture,
          inner: appearance.radius * appearance.ring.inner,
          outer: appearance.radius * appearance.ring.outer,
        },
      }),
    });
  }

  // 천체는 전부 황도면(y=0) 위에 있으므로 간격도 평면에서 잰다
  for (const body of bodies) {
    for (const other of bodies) {
      if (other === body) continue;
      body.spacing = Math.min(
        body.spacing,
        Math.hypot(
          body.position[0] - other.position[0],
          body.position[2] - other.position[2],
        ),
      );
    }
  }

  for (const id of Object.keys(APPEARANCE)) {
    const group = dataset.groups[id];
    if (group && isCelestialBodyGroup(group)) continue;
    issues.push(
      `비주얼 표에만 있고 성계 뷰에 없는 천체: "${id}" (src/starchart/bodies.ts에서 지워야 한다)`,
    );
  }

  return { bodies, issues };
}
