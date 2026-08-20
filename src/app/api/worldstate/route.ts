import { fetchWorldState } from "@/worldstate/fetch";

// 위젯이 이 라우트를 통해서만 외부 API에 닿는다. 캐싱·폴백은 fetchWorldState가 맡는다.
// 프리렌더로 응답이 빌드 시각에 굳어버리면 안 되므로(타임스탬프가 절대시각이다)
// 항상 동적으로 처리하고, 외부 호출 억제는 fetchWorldState의 TTL 캐시에 맡긴다.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await fetchWorldState());
}
