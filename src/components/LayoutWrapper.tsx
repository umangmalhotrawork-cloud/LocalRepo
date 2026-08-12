"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false });
const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });
const AnimatedBackgroundV2 = dynamic(() => import("@/components/ui/AnimatedBackgroundV2"), { ssr: false });

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDesktopApp = pathname === "/desktop" || pathname?.startsWith("/desktop");

  if (isDesktopApp) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-[#050505] text-white select-none">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#050505] text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      {mounted && <AnimatedBackgroundV2 />}
      {mounted && <Navbar />}
      <main className="flex-grow z-10 relative">{children}</main>
      {mounted && <Footer />}
    </div>
  );
}
