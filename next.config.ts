import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉터리의 무관한 락파일 때문에 워크스페이스 루트가 잘못 추론되는 것을 방지
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
