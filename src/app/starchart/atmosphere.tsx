"use client";

/**
 * 프레넬 대기 셸.
 *
 * 지표면보다 살짝 큰 구체를 뒷면(BackSide)만 그려서 가산 합성으로 얹는다 —
 * 행성 실루엣 바깥에 고리 모양의 영역이 남고, 거기에 지표면에 붙을수록 밝은
 * 림 글로우를 칠하면 대기가 된다(#31의 (b) 백페이스 대기 셸).
 *
 * 대기색은 행성별 오버라이드로 들어와, 실사 텍스처 위에 인게임 무드를 얹는다.
 */
import { useMemo } from "react";
import { AdditiveBlending, BackSide, Color } from "three";

const vertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  uniform float uInner;

  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    // 뒷면만 그리므로 화면에 남는 것은 행성 실루엣 바깥의 고리다. 그 안에서
    // |dot|은 안쪽 경계(지표면)에서 가장 크고 바깥 경계에서 0이 된다 — 대기는
    // 지표면에 붙어 가장 밝고 밖으로 갈수록 사라지므로 이 값을 그대로 쓴다.
    // 뒤집으면 행성을 테두리로 감싼 동그라미처럼 보인다.
    float edge = sqrt(max(1.0 - uInner * uInner, 1e-4));
    float glow = pow(clamp(abs(dot(normal, viewDir)) / edge, 0.0, 1.0), uPower);
    // 태양이 성계 뷰의 원점이다 — 빛을 받는 쪽 대기를 더 밝힌다
    float lit = smoothstep(-0.4, 0.7, dot(normal, normalize(-vPositionW)));
    gl_FragColor = vec4(uColor * uIntensity, glow * (0.3 + 0.7 * lit));
    #include <colorspace_fragment>
  }
`;

export function AtmosphereShell({
  surfaceRadius,
  shellRadius,
  color,
}: {
  surfaceRadius: number;
  shellRadius: number;
  color: string;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uPower: { value: 1.6 },
      uIntensity: { value: 1.4 },
      uInner: { value: surfaceRadius / shellRadius },
    }),
    [color, surfaceRadius, shellRadius],
  );

  return (
    <mesh>
      <sphereGeometry args={[shellRadius, 48, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={BackSide}
        blending={AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
