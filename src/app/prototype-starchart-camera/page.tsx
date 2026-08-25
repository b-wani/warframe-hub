"use client";

// PROTOTYPE — 이슈 #32. 성계 뷰↔행성 뷰 3D 카메라 전환·인터랙션 3변형 비교.
// ?variant= 으로 전환. 병합 금지·던져버리는 코드.

import dynamic from "next/dynamic";
import { Suspense } from "react";

const Prototype = dynamic(() => import("./prototype"), {
  ssr: false,
  loading: () => (
    <p style={{ color: "#8aa", padding: 24, fontFamily: "monospace" }}>
      3D 프로토타입 로딩 중…
    </p>
  ),
});

export default function Page() {
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  );
}
