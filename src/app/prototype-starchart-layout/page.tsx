"use client";

// PROTOTYPE — 이슈 #29. 행성 내 노드 force-directed 초기 배치 + 보정 워크플로 비교.
// 변형 3개를 ?variant= 으로 전환, 병합 금지·던져버리는 코드.
// A: 보기 전용 + JSON 직접 편집 워크플로 / B: 드래그 편집 UI / C: 스크린샷 트레이싱

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import starchart from "@/data/starchart.json";

type NodeDatum = {
  name: string;
  group: string;
  missionName: string;
  nextNodes: string[];
};
type Pt = { x: number; y: number };

const data = starchart as unknown as {
  groups: Record<string, { name: string; type: string }>;
  nodes: Record<string, NodeDatum>;
};

const W = 900;
const H = 620;

function groupNodes(group: string): [string, NodeDatum][] {
  return Object.entries(data.nodes).filter(([, n]) => n.group === group);
}

// 간이 force 시뮬레이션: 반발 + 간선 스프링 + 중심 인력. 시드 고정(각도 배치)이라 재현 가능.
function runForceLayout(group: string, iterations = 300): Record<string, Pt> {
  const entries = groupNodes(group);
  const ids = entries.map(([id]) => id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const pos: Pt[] = ids.map((_, i) => ({
    x: W / 2 + 200 * Math.cos((i / ids.length) * Math.PI * 2),
    y: H / 2 + 180 * Math.sin((i / ids.length) * Math.PI * 2),
  }));
  const links: [number, number][] = [];
  for (const [id, n] of entries) {
    for (const nx of n.nextNodes) {
      const j = idx.get(nx);
      if (j !== undefined) links.push([idx.get(id)!, j]);
    }
  }
  const LINK_LEN = 90;
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    // 반발
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const f = (12000 / d2) * t;
        const d = Math.sqrt(d2);
        pos[i].x -= (dx / d) * f;
        pos[i].y -= (dy / d) * f;
        pos[j].x += (dx / d) * f;
        pos[j].y += (dy / d) * f;
      }
    }
    // 간선 스프링
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = ((d - LINK_LEN) / d) * 0.05;
      pos[a].x += dx * f;
      pos[a].y += dy * f;
      pos[b].x -= dx * f;
      pos[b].y -= dy * f;
    }
    // 중심 인력
    for (const p of pos) {
      p.x += (W / 2 - p.x) * 0.003;
      p.y += (H / 2 - p.y) * 0.003;
    }
  }
  const out: Record<string, Pt> = {};
  ids.forEach((id, i) => {
    out[id] = { x: Math.round(pos[i].x), y: Math.round(pos[i].y) };
  });
  return out;
}

function exportJson(group: string, coords: Record<string, Pt>): string {
  return JSON.stringify({ [group]: coords }, null, 2);
}

function Graph({
  group,
  coords,
  onDrag,
  onSelect,
  selected,
  background,
  bgOpacity,
}: {
  group: string;
  coords: Record<string, Pt>;
  onDrag?: (id: string, p: Pt) => void;
  onSelect?: (id: string) => void;
  selected?: string | null;
  background?: string | null;
  bgOpacity?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);
  const entries = groupNodes(group);

  function toLocal(e: React.PointerEvent): Pt {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * W),
      y: Math.round(((e.clientY - rect.top) / rect.height) * H),
    };
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", background: "#0b1020", borderRadius: 8, touchAction: "none" }}
      onPointerMove={(e) => {
        if (dragging.current && onDrag) onDrag(dragging.current, toLocal(e));
      }}
      onPointerUp={() => (dragging.current = null)}
      onPointerLeave={() => (dragging.current = null)}
    >
      {background && (
        <image href={background} x={0} y={0} width={W} height={H} opacity={bgOpacity ?? 0.5} preserveAspectRatio="xMidYMid meet" />
      )}
      {entries.flatMap(([id, n]) =>
        n.nextNodes
          .filter((nx) => coords[nx] && coords[id])
          .map((nx) => (
            <line
              key={`${id}-${nx}`}
              x1={coords[id].x}
              y1={coords[id].y}
              x2={coords[nx].x}
              y2={coords[nx].y}
              stroke="#4a5a8a"
              strokeWidth={1.5}
            />
          )),
      )}
      {entries.map(([id, n]) => {
        const p = coords[id];
        if (!p) return null;
        return (
          <g
            key={id}
            transform={`translate(${p.x},${p.y})`}
            style={{ cursor: onDrag ? "grab" : onSelect ? "pointer" : "default" }}
            onPointerDown={(e) => {
              if (onDrag) {
                dragging.current = id;
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }
              onSelect?.(id);
            }}
          >
            <rect
              x={-7}
              y={-7}
              width={14}
              height={14}
              transform="rotate(45)"
              fill={selected === id ? "#ffd35c" : "#8fb4ff"}
              stroke="#dfe8ff"
              strokeWidth={1}
            />
            <text y={-14} textAnchor="middle" fill="#c8d4f5" fontSize={11}>
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GroupPicker({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 6 }}>
      {Object.entries(data.groups).map(([id, g]) => (
        <option key={id} value={id}>
          {g.name} ({groupNodes(id).length})
        </option>
      ))}
    </select>
  );
}

// 변형 A — 보기 전용 + JSON 직접 편집 워크플로
function VariantA({ group }: { group: string }) {
  const coords = useMemo(() => runForceLayout(group), [group]);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
      <Graph group={group} coords={coords} onSelect={setSelected} selected={selected} />
      <div>
        <h3>A — JSON 직접 편집</h3>
        <p style={{ fontSize: 13 }}>
          배치는 읽기 전용. 노드를 클릭해 좌표 스니펫을 복사하고, 에디터에서 좌표 파일을 직접 수정한 뒤 새로고침으로 확인하는
          워크플로.
        </p>
        {selected && (
          <>
            <pre style={{ background: "#111", color: "#9f9", padding: 8, fontSize: 12 }}>
              {`"${selected}": ${JSON.stringify(coords[selected])}`}
            </pre>
            <button onClick={() => navigator.clipboard.writeText(`"${selected}": ${JSON.stringify(coords[selected])}`)}>
              스니펫 복사
            </button>
          </>
        )}
        <details style={{ marginTop: 12 }}>
          <summary>행성 전체 JSON</summary>
          <textarea readOnly value={exportJson(group, coords)} style={{ width: "100%", height: 260, fontSize: 11 }} />
        </details>
      </div>
    </div>
  );
}

// 변형 B — 드래그 편집 UI
function VariantB({ group }: { group: string }) {
  const [coords, setCoords] = useState<Record<string, Pt>>(() => runForceLayout(group));
  useEffect(() => setCoords(runForceLayout(group)), [group]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
      <Graph group={group} coords={coords} onDrag={(id, p) => setCoords((c) => ({ ...c, [id]: p }))} />
      <div>
        <h3>B — 드래그 편집 UI</h3>
        <p style={{ fontSize: 13 }}>force 초기 배치를 출발점으로 노드를 직접 끌어서 보정. 끝나면 JSON 일괄 내보내기.</p>
        <button onClick={() => setCoords(runForceLayout(group))}>force 재배치</button>{" "}
        <button onClick={() => navigator.clipboard.writeText(exportJson(group, coords))}>JSON 복사</button>
        <textarea readOnly value={exportJson(group, coords)} style={{ width: "100%", height: 320, fontSize: 11, marginTop: 8 }} />
      </div>
    </div>
  );
}

// 변형 C — 스크린샷 트레이싱
function VariantC({ group }: { group: string }) {
  const [coords, setCoords] = useState<Record<string, Pt>>(() => runForceLayout(group));
  const [bg, setBg] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  useEffect(() => setCoords(runForceLayout(group)), [group]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
      <Graph
        group={group}
        coords={coords}
        onDrag={(id, p) => setCoords((c) => ({ ...c, [id]: p }))}
        background={bg}
        bgOpacity={opacity}
      />
      <div>
        <h3>C — 스크린샷 트레이싱</h3>
        <p style={{ fontSize: 13 }}>인게임 성계지도 스크린샷을 배경에 깔고, 그 위에 노드를 끌어다 맞춘 뒤 JSON 내보내기.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setBg(URL.createObjectURL(f));
          }}
        />
        <div style={{ margin: "8px 0" }}>
          배경 투명도{" "}
          <input type="range" min={0.1} max={1} step={0.1} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
        </div>
        <button onClick={() => navigator.clipboard.writeText(exportJson(group, coords))}>JSON 복사</button>
        <textarea readOnly value={exportJson(group, coords)} style={{ width: "100%", height: 280, fontSize: 11, marginTop: 8 }} />
      </div>
    </div>
  );
}

const VARIANTS = [
  ["A", "JSON 직접 편집"],
  ["B", "드래그 편집 UI"],
  ["C", "스크린샷 트레이싱"],
] as const;

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const variant = params.get("variant") ?? "A";
  const [group, setGroup] = useState("Mercury");
  const i = VARIANTS.findIndex(([k]) => k === variant);
  const go = (d: number) => {
    const next = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length][0];
    router.replace(`?variant=${next}`);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <main style={{ padding: 16, maxWidth: 1280, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>PROTOTYPE — 스타차트 좌표 배치·보정 워크플로 (#29)</h1>
      <div style={{ margin: "8px 0" }}>
        행성: <GroupPicker value={group} onChange={setGroup} />
      </div>
      {variant === "A" && <VariantA group={group} />}
      {variant === "B" && <VariantB group={group} />}
      {variant === "C" && <VariantC group={group} />}
      {process.env.NODE_ENV !== "production" && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#000",
            color: "#fff",
            borderRadius: 24,
            padding: "8px 16px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,.4)",
          }}
        >
          <button onClick={() => go(-1)}>←</button>
          <span>
            {variant} — {VARIANTS[i]?.[1]}
          </span>
          <button onClick={() => go(1)}>→</button>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
