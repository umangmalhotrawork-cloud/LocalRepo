import Hero from "@/components/Hero";
import TrustBanner from "@/components/TrustBanner";
import IDECoreSection from "@/components/IDECoreSection";
import FeatureSection from "@/components/FeatureCard";
import AgentSection from "@/components/AgentSection";
import DebuggerSection from "@/components/DebuggerSection";
import TestExplorerSection from "@/components/TestExplorerSection";
import ProfilerSection from "@/components/ProfilerSection";
import SecurityAuditSection from "@/components/SecurityAuditSection";
import ReliabilitySection from "@/components/ReliabilitySection";
import BenchmarksSection from "@/components/BenchmarksSection";
import CodeDemo from "@/components/CodeDemo";
import DownloadsSection from "@/components/DownloadsSection";
import FAQAccordion from "@/components/FAQAccordion";
import CTASection from "@/components/CTASection";

export default function HomePage() {
  return (
    <div className="space-y-0 bg-[#050508]">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Trust & Privacy Guarantees */}
      <TrustBanner />

      {/* 3. The Desktop IDE Core Workspace */}
      <IDECoreSection />

      {/* 4. Causal Code Tomography & AST Surgery */}
      <FeatureSection />

      {/* 5. Autonomous AI Agent Mode */}
      <AgentSection />

      {/* 6. Time Travel Debugger v2 */}
      <DebuggerSection />

      {/* 7. Test Explorer & Coverage Dashboard */}
      <TestExplorerSection />

      {/* 8. Performance Profiler */}
      <ProfilerSection />

      {/* 9. Security & Dependency Audit */}
      <SecurityAuditSection />

      {/* 10. Reliability & Workspace Snapshots */}
      <ReliabilitySection />

      {/* 11. Empirical Benchmarks */}
      <BenchmarksSection />

      {/* 12. Interactive In-Browser AST Surgery Playground */}
      <div className="py-14 bg-[#050508] border-b border-[#1f1f24]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span>INTERACTIVE PLAYGROUND</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
              Live AST Mutation &amp; Surgery Simulation.
            </h2>
          </div>
          <CodeDemo />
        </div>
      </div>

      {/* 13. Cross-Platform Downloads */}
      <DownloadsSection />

      {/* 14. Technical FAQ */}
      <FAQAccordion />

      {/* 15. Final Conversion CTA */}
      <CTASection />
    </div>
  );
}
