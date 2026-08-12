"use client";

import dynamic from "next/dynamic";

const IDEApp = dynamic(() => import("../renderer/IDEApp"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#050505] text-cyan-400 flex items-center justify-center font-mono text-sm">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        <span>Loading Echo Nullity Desktop IDE...</span>
      </div>
    </div>
  ),
});

export default function DesktopPage() {
  return <IDEApp />;
}
