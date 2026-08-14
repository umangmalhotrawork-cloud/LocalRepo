"use client";

import dynamic from "next/dynamic";

const IDEApp = dynamic(() => import("../../../desktop/renderer/IDEApp"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-black text-cyan-400 flex items-center justify-center font-mono text-sm">
      Loading Echo Nullity…
    </div>
  ),
});

export default function DesktopPage() {
  return <IDEApp />;
}
