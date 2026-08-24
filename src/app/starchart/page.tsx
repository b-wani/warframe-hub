// PROTOTYPE (#23) — 스타차트 raw 수직 슬라이스. 던져버릴 코드.
// 질문: 월드스테이트(기존 데이터)와 노드 데이터 원형이 화면까지 흐르는가.
// 스타일·추상화·에러 처리 없음. 데이터가 눈에 보이는 것이 전부.
import { fetchWorldState } from "@/worldstate/fetch";
import rawRegions from "./export-regions.prototype.json";

export const dynamic = "force-dynamic";

type RawNode = {
  name: string;
  systemName: string;
  missionType?: string;
  faction?: string;
  minEnemyLevel?: number;
  maxEnemyLevel?: number;
  masteryReq?: number;
  nextNodes?: string[];
};

const lastSegment = (path: string) => path.split("/").pop() ?? path;

export default async function StarchartPrototypePage() {
  const worldState = await fetchWorldState();
  const nodes = Object.entries(rawRegions as Record<string, RawNode>);

  const byPlanet = new Map<string, [string, RawNode][]>();
  for (const entry of nodes) {
    const planet = lastSegment(entry[1].systemName);
    byPlanet.set(planet, [...(byPlanet.get(planet) ?? []), entry]);
  }
  const edgeCount = nodes.reduce(
    (sum, [, node]) => sum + (node.nextNodes?.length ?? 0),
    0,
  );

  return (
    <main style={{ fontFamily: "monospace", padding: 16 }}>
      <h1>/starchart — PROTOTYPE raw 수직 슬라이스 (#23)</h1>

      <h2>① 월드스테이트 (api.warframestat.us → fetchWorldState)</h2>
      <pre>{JSON.stringify(worldState, null, 2)}</pre>

      <h2>
        ② 노드 데이터 원형 (ExportRegions.json) — 노드 {nodes.length}개 /
        행성 {byPlanet.size}개 / 연결 간선 {edgeCount}개
      </h2>
      {[...byPlanet.entries()].map(([planet, planetNodes]) => (
        <details key={planet}>
          <summary>
            {planet} ({planetNodes.length}노드)
          </summary>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>id</th>
                <th>name</th>
                <th>mission</th>
                <th>faction</th>
                <th>level</th>
                <th>MR</th>
                <th>nextNodes</th>
              </tr>
            </thead>
            <tbody>
              {planetNodes.map(([id, node]) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{lastSegment(node.name)}</td>
                  <td>{node.missionType ?? "-"}</td>
                  <td>{node.faction ?? "-"}</td>
                  <td>
                    {node.minEnemyLevel ?? "?"}–{node.maxEnemyLevel ?? "?"}
                  </td>
                  <td>{node.masteryReq ?? 0}</td>
                  <td>{node.nextNodes?.map(lastSegment).join(", ") ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </main>
  );
}
