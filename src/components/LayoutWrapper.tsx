"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnimatedBackgroundV2 from "@/components/ui/AnimatedBackgroundV2";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      <AnimatedBackgroundV2 />
      <Navbar />
      <main className="flex-grow z-10 relative">{children}</main>
      <Footer />
    </div>
  );
}
