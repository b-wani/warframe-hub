"use client";

// PROTOTYPE — 이슈 #32. 세 변형은 "성계 뷰 ↔ 행성 뷰" 전환의 구조 자체가 다르다:
//   A 연속 비행   — 한 장면, 카메라가 행성까지 시네마틱하게 날아간다 (CameraControls)
//   B 시네마틱 컷 — 두 장면, 급가속 줌인 + 페이드 컷으로 행성 전용 장면으로 교체
//   C 제자리 모프 — 카메라 고정, 선택한 행성이 중앙으로 커지고 나머지는 밀려난다
// 공통: 행성 뷰에서 프록시마(레일잭) 토글 — 행성 종속 표시 연출 검증.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import starchart from "@/data/starchart.json";

/* ── 데이터 ── */

type NodeDatum = {
  name: string;
  group: string;
  missionName: string;
  factionName?: string;
  minEnemyLevel?: number;
  maxEnemyLevel?: number;
  nextNodes: string[];
};
const data = starchart as unknown as {
  groups: Record<string, { name: string; type: string }>;
  nodes: Record<string, NodeDatum>;
};

const PLANETS = Object.entries(data.groups)
  .filter(([, g]) => g.type === "planet")
  .map(([key, g]) => ({ key, name: g.name }));

const PLANET_COLOR: Record<string, string> = {
  Mercury: "#b8a58c", Venus: "#e8c46a", Earth: "#4f8fd0", Mars: "#c96a45",
  Jupiter: "#d9a066", Saturn: "#e0c48f", Uranus: "#8fd0d9", Neptune: "#4f6fd0",
  Pluto: "#9c8fb8", Ceres: "#8f9c8a", Eris: "#c9d0d9", Sedna: "#b84f5f",
  Europa: "#a8c9e0", Phobos: "#a8907c", SolarMapDeimosName: "#7c4f45",
  Moon: "#d0d0d8", TauRegion: "#e0e8ff",
};

function planetColor(key: string): string {
  return PLANET_COLOR[key] ?? "#889";
}

// 성계 배치: 황금각 나선 궤도 (좌표 데이터가 아직 없으므로 결정적 배치)
const SYSTEM_POS: Record<string, THREE.Vector3> = {};
PLANETS.forEach((p, i) => {
  const r = 14 + i * 5.5;
  const a = i * 2.39996; // golden angle
  SYSTEM_POS[p.key] = new THREE.Vector3(
    Math.cos(a) * r,
    Math.sin(i * 1.7) * 3,
    Math.sin(a) * r,
  );
});

function groupNodes(group: string): [string, NodeDatum][] {
  return Object.entries(data.nodes).filter(([, n]) => n.group === group);
}

// #29에서 검증한 간이 force 배치를 그대로 축소 이식 (2D → 행성 주변 평면)
function forceLayout(group: string): Record<string, { x: number; y: number }> {
  const entries = groupNodes(group);
  const ids = entries.map(([id]) => id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const pos = ids.map((_, i) => ({
    x: Math.cos((i / ids.length) * Math.PI * 2) * 6,
    y: Math.sin((i / ids.length) * Math.PI * 2) * 5,
  }));
  const links: [number, number][] = [];
  for (const [id, n] of entries)
    for (const nx of n.nextNodes) {
      const j = idx.get(nx);
      if (j !== undefined) links.push([idx.get(id)!, j]);
    }
  for (let it = 0; it < 200; it++) {
    const t = 1 - it / 200;
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        const d2 = Math.max(dx * dx + dy * dy, 0.04);
        const f = (6 / d2) * t, d = Math.sqrt(d2);
        pos[i].x -= (dx / d) * f; pos[i].y -= (dy / d) * f;
        pos[j].x += (dx / d) * f; pos[j].y += (dy / d) * f;
      }
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = ((d - 2.4) / d) * 0.05;
      pos[a].x += dx * f; pos[a].y += dy * f;
      pos[b].x -= dx * f; pos[b].y -= dy * f;
    }
    for (const p of pos) { p.x *= 0.998; p.y *= 0.998; }
  }
  const out: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, i) => (out[id] = pos[i]));
  return out;
}

const layoutCache = new Map<string, Record<string, { x: number; y: number }>>();
function cachedLayout(group: string) {
  if (!layoutCache.has(group)) layoutCache.set(group, forceLayout(group));
  return layoutCache.get(group)!;
}

function proximaKey(planet: string): string | null {
  return data.groups[`${planet}_SPACE`] ? `${planet}_SPACE` : null;
}

/* ── 공통 3D 부품 ── */

function Planet({
  pk, pos, scale = 1, dim = 1, onClick, label,
}: {
  pk: string; pos: THREE.Vector3 | [number, number, number];
  scale?: number; dim?: number; label?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = planetColor(pk);
  return (
    <group position={pos as THREE.Vector3} scale={scale}>
      <mesh
        onClick={onClick && ((e) => { e.stopPropagation(); onClick(); })}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 0.55 : 0.18}
          transparent opacity={dim}
        />
      </mesh>
      {/* 프레넬 대기 셸 근사 (#31): 뒷면만 그리는 반투명 셸 */}
      <mesh scale={1.18}>
        <sphereGeometry args={[1.6, 24, 24]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.16 * dim}
          side={THREE.BackSide}
        />
      </mesh>
      {label && dim > 0.35 && (
        <Html center distanceFactor={70} position={[0, 2.6, 0]}
          style={{ pointerEvents: "none" }}>
          <span style={{
            color: hover ? "#fff" : "#cdd6e4", fontSize: 13,
            fontFamily: "monospace", whiteSpace: "nowrap",
            textShadow: "0 0 6px #000",
          }}>
            {data.groups[pk].name}
          </span>
        </Html>
      )}
    </group>
  );
}

// 행성 뷰의 노드 구름: force 배치 평면 + 간선, 프록시마는 바깥 고리(파랑)
function NodeCloud({
  planet, center, showProxima, cloudScale = 1,
}: {
  planet: string; center: THREE.Vector3 | [number, number, number];
  showProxima: boolean; cloudScale?: number;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const layout = cachedLayout(planet);
  const entries = groupNodes(planet);
  const prox = proximaKey(planet);
  const proxEntries = showProxima && prox ? groupNodes(prox) : [];

  return (
    <group position={center as THREE.Vector3} scale={cloudScale}>
      {/* 간선 */}
      {entries.map(([id, n]) =>
        n.nextNodes.filter((nx) => layout[nx]).map((nx) => {
          const a = layout[id], b = layout[nx];
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(a.x, a.y, 0), new THREE.Vector3(b.x, b.y, 0),
          ]);
          return (
            <line key={`${id}-${nx}`}>
              <primitive object={geo} attach="geometry" />
              <lineBasicMaterial color="#3a4a66" transparent opacity={0.7} />
            </line>
          );
        }),
      )}
      {/* 노드: 인게임 마름모 → 옥타헤드론 */}
      {entries.map(([id, n]) => {
        const p = layout[id];
        return (
          <group key={id} position={[p.x, p.y, 0]}>
            <mesh
              onPointerOver={() => setHoverId(id)}
              onPointerOut={() => setHoverId(null)}
            >
              <octahedronGeometry args={[0.34]} />
              <meshStandardMaterial
                color={hoverId === id ? "#ffd97a" : "#dfe8f5"}
                emissive={hoverId === id ? "#ffb347" : "#5a7099"}
                emissiveIntensity={0.6}
              />
            </mesh>
            {hoverId === id && (
              <Html center distanceFactor={40} position={[0, 0.9, 0]}
                style={{ pointerEvents: "none" }}>
                <div style={{
                  background: "#0b1220ee", border: "1px solid #3a4a66",
                  color: "#dfe8f5", padding: "4px 8px", fontSize: 12,
                  fontFamily: "monospace", whiteSpace: "nowrap", borderRadius: 4,
                }}>
                  {n.name} · {n.missionName}
                  {n.minEnemyLevel != null && ` (${n.minEnemyLevel}-${n.maxEnemyLevel})`}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      {/* 프록시마 고리 */}
      {proxEntries.map(([id, n], i) => {
        const a = (i / proxEntries.length) * Math.PI * 2;
        const x = Math.cos(a) * 9, y = Math.sin(a) * 7.5;
        return (
          <group key={id} position={[x, y, -1]}>
            <mesh
              onPointerOver={() => setHoverId(id)}
              onPointerOut={() => setHoverId(null)}
            >
              <octahedronGeometry args={[0.34]} />
              <meshStandardMaterial color="#7ab8ff" emissive="#2a6fd0"
                emissiveIntensity={0.9} />
            </mesh>
            {hoverId === id && (
              <Html center distanceFactor={40} position={[0, 0.9, 0]}
                style={{ pointerEvents: "none" }}>
                <div style={{
                  background: "#0b1220ee", border: "1px solid #2a6fd0",
                  color: "#bcd8ff", padding: "4px 8px", fontSize: 12,
                  fontFamily: "monospace", whiteSpace: "nowrap", borderRadius: 4,
                }}>
                  ⚓ {n.name} · {n.missionName}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      {showProxima && prox && (
        <mesh rotation={[0, 0, 0]}>
          <ringGeometry args={[8.2, 8.28, 64]} />
          <meshBasicMaterial color="#2a6fd0" transparent opacity={0.5}
            side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 20, 0]} intensity={900} color="#ffe9c9" />
      <directionalLight position={[30, 30, 30]} intensity={1.2} />
    </>
  );
}

function Sun() {
  return (
    <mesh>
      <sphereGeometry args={[4, 32, 32]} />
      <meshBasicMaterial color="#ffd27a" />
    </mesh>
  );
}

/* ── 변형 A: 연속 비행 (한 장면, CameraControls 시네마틱 이동) ── */

function VariantA({
  focus, setFocus, showProxima,
}: VariantProps) {
  const controls = useRef<CameraControls>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (focus) {
      const p = SYSTEM_POS[focus];
      // 행성 정면 살짝 위에서 내려다보는 포즈로 비행
      c.setLookAt(p.x, p.y + 3, p.z + 16, p.x, p.y, p.z, true);
    } else {
      c.setLookAt(0, 55, 95, 0, 0, 0, true);
    }
  }, [focus]);

  return (
    <Canvas camera={{ position: [0, 55, 95], fov: 45 }}>
      <color attach="background" args={["#05070d"]} />
      <Stars radius={300} depth={60} count={4000} factor={4} fade />
      <Lights />
      <Sun />
      <CameraControls ref={controls} smoothTime={0.55} maxDistance={160} />
      {PLANETS.map((p) => (
        <Planet key={p.key} pk={p.key} pos={SYSTEM_POS[p.key]}
          label={focus !== p.key} dim={focus && focus !== p.key ? 0.35 : 1}
          onClick={() => setFocus(p.key)} />
      ))}
      {focus && (
        <NodeCloud planet={focus} showProxima={showProxima}
          center={[SYSTEM_POS[focus].x, SYSTEM_POS[focus].y, SYSTEM_POS[focus].z + 4]}
          cloudScale={0.6} />
      )}
    </Canvas>
  );
}

/* ── 변형 B: 시네마틱 컷 (급가속 줌 + 페이드로 장면 교체) ── */

function WarpRig({ target, phase }: { target: string | null; phase: string }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    if (phase === "warpOut" && target) {
      const p = SYSTEM_POS[target];
      const dst = new THREE.Vector3(p.x, p.y + 1, p.z + 5);
      camera.position.lerp(dst, Math.min(1, dt * 5.5)); // 급가속
      camera.lookAt(p);
    }
  });
  return null;
}

function VariantB({ focus, setFocus, showProxima }: VariantProps) {
  const [phase, setPhase] = useState<"system" | "warpOut" | "planet" | "warpIn">("system");
  const [target, setTarget] = useState<string | null>(null);

  // focus 변경(외부 back 버튼 포함)과 내부 페이즈 동기화.
  // phase를 deps에 넣으면 setPhase 직후 cleanup이 타이머를 지워버리므로 focus에만 반응한다.
  useEffect(() => {
    if (focus) {
      setTarget(focus);
      setPhase("warpOut");
      const t = setTimeout(() => setPhase("planet"), 480);
      return () => clearTimeout(t);
    }
    setPhase((p) => (p === "system" ? p : "warpIn"));
    const t = setTimeout(() => { setPhase("system"); setTarget(null); }, 380);
    return () => clearTimeout(t);
  }, [focus]);

  const fading = phase === "warpOut" || phase === "warpIn";
  const inPlanet = phase === "planet" || (phase === "warpIn" && target);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {!inPlanet ? (
        <Canvas camera={{ position: [0, 55, 95], fov: 45 }}>
          <color attach="background" args={["#05070d"]} />
          <Stars radius={300} depth={60} count={4000} factor={4} fade />
          <Lights />
          <Sun />
          <WarpRig target={target} phase={phase} />
          {PLANETS.map((p) => (
            <Planet key={p.key} pk={p.key} pos={SYSTEM_POS[p.key]} label
              onClick={() => phase === "system" && setFocus(p.key)} />
          ))}
        </Canvas>
      ) : (
        <Canvas camera={{ position: [0, 0, 22], fov: 42 }}>
          <color attach="background" args={["#070a12"]} />
          <Stars radius={200} depth={40} count={2500} factor={3} fade />
          <Lights />
          {target && (
            <>
              {/* 행성 전용 장면: 행성을 왼쪽에 크게, 노드 평면을 오른쪽에 */}
              <Planet pk={target} pos={[-9, 0, -4]} scale={3.2} />
              <NodeCloud planet={target} center={[3, 0, 0]}
                showProxima={showProxima} />
            </>
          )}
        </Canvas>
      )}
      {/* 워프 플래시 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle, #cfe4ff 0%, #05070d 90%)",
        opacity: fading ? 1 : 0,
        transition: `opacity ${fading ? 0.42 : 0.5}s ease`,
      }} />
    </div>
  );
}

/* ── 변형 C: 제자리 모프 (카메라 고정, 행성이 중앙으로 확대) ── */

function MorphPlanet({
  pk, index, focus, onClick,
}: {
  pk: string; index: number; focus: string | null; onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  // 평면 원형 배치 (카메라 정면)
  const base = useMemo(() => {
    const a = (index / PLANETS.length) * Math.PI * 2 - Math.PI / 2;
    const r = 16 + (index % 3) * 4;
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.62, 0);
  }, [index]);

  const selected = focus === pk;
  const dimmed = focus !== null && !selected;

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const targetPos = selected
      ? new THREE.Vector3(-11, 0, 6)
      : dimmed
        ? base.clone().multiplyScalar(1.8)
        : base;
    const targetScale = selected ? 3 : dimmed ? 0.5 : 1;
    g.position.lerp(targetPos, Math.min(1, dt * 4));
    const s = THREE.MathUtils.lerp(g.scale.x, targetScale, Math.min(1, dt * 4));
    g.scale.setScalar(s);
  });

  return (
    <group ref={ref} position={base}>
      <Planet pk={pk} pos={[0, 0, 0]} label={!dimmed}
        dim={dimmed ? 0.25 : 1} onClick={onClick} />
    </group>
  );
}

function VariantC({ focus, setFocus, showProxima }: VariantProps) {
  return (
    <Canvas camera={{ position: [0, 0, 46], fov: 50 }}>
      <color attach="background" args={["#05070d"]} />
      <Stars radius={300} depth={60} count={4000} factor={4} fade />
      <Lights />
      {PLANETS.map((p, i) => (
        <MorphPlanet key={p.key} pk={p.key} index={i} focus={focus}
          onClick={() => setFocus(focus === p.key ? null : p.key)} />
      ))}
      {focus && (
        <NodeCloud planet={focus} center={[6, 0, 6]} showProxima={showProxima} />
      )}
    </Canvas>
  );
}

/* ── 셸: HUD + 변형 스위처 ── */

type VariantProps = {
  focus: string | null;
  setFocus: (k: string | null) => void;
  showProxima: boolean;
};

const VARIANTS = [
  { key: "A", name: "연속 비행", desc: "한 장면 — 카메라가 행성까지 날아간다" },
  { key: "B", name: "시네마틱 컷", desc: "급가속 줌 + 페이드로 행성 장면 교체" },
  { key: "C", name: "제자리 모프", desc: "카메라 고정 — 행성이 중앙으로 확대" },
] as const;

export default function Prototype() {
  const router = useRouter();
  const params = useSearchParams();
  const variant = (params.get("variant") ?? "A").toUpperCase();
  const vi = Math.max(0, VARIANTS.findIndex((v) => v.key === variant));
  const [focus, setFocus] = useState<string | null>(null);
  const [showProxima, setShowProxima] = useState(false);

  const go = useCallback((di: number) => {
    const next = VARIANTS[(vi + di + VARIANTS.length) % VARIANTS.length].key;
    router.replace(`?variant=${next}`);
    setFocus(null);
    setShowProxima(false);
  }, [vi, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape") setFocus(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const V = [VariantA, VariantB, VariantC][vi];
  const cur = VARIANTS[vi];
  const prox = focus ? proximaKey(focus) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#05070d",
      fontFamily: "monospace",
    }}>
      <V focus={focus} setFocus={setFocus} showProxima={showProxima} />

      {/* HUD */}
      <div style={{
        position: "absolute", top: 16, left: 16, color: "#8fa3c4",
        fontSize: 13, lineHeight: 1.7, pointerEvents: "none",
      }}>
        <div style={{ color: "#dfe8f5", fontSize: 15 }}>
          PROTOTYPE #32 — 카메라 전환 비교
        </div>
        <div>뷰: {focus ? `행성 — ${data.groups[focus].name}` : "성계"}</div>
        <div style={{ opacity: 0.7 }}>{cur.desc} · 행성 클릭 / ESC 뒤로</div>
      </div>

      {/* 행성 뷰 컨트롤 */}
      {focus && (
        <div style={{
          position: "absolute", top: 16, right: 16, display: "flex",
          gap: 8, flexDirection: "column", alignItems: "flex-end",
        }}>
          <button onClick={() => setFocus(null)} style={btnStyle}>
            ← 성계로
          </button>
          {prox && (
            <button onClick={() => setShowProxima((s) => !s)}
              style={{ ...btnStyle, borderColor: "#2a6fd0",
                color: showProxima ? "#7ab8ff" : "#8fa3c4" }}>
              ⚓ 프록시마 {showProxima ? "ON" : "OFF"}
            </button>
          )}
        </div>
      )}

      {/* 변형 스위처 (production 빌드에서 숨김) */}
      {process.env.NODE_ENV !== "production" && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%",
          transform: "translateX(-50%)", display: "flex",
          alignItems: "center", gap: 12, background: "#101828f0",
          border: "1px solid #2a3a55", borderRadius: 999,
          padding: "8px 16px", color: "#dfe8f5", fontSize: 14,
          boxShadow: "0 4px 18px #000a",
        }}>
          <button onClick={() => go(-1)} style={arrowStyle}>←</button>
          <span style={{ minWidth: 180, textAlign: "center" }}>
            {cur.key} — {cur.name}
          </span>
          <button onClick={() => go(1)} style={arrowStyle}>→</button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#101828e0", border: "1px solid #2a3a55", color: "#dfe8f5",
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "monospace", fontSize: 13,
};
const arrowStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#7ab8ff",
  fontSize: 18, cursor: "pointer", padding: "0 6px",
};
