import Hero from "@/components/Hero";
import TrustBanner from "@/components/TrustBanner";
import IDECoreSection from "@/components/IDECoreSection";
import ContinuumSection from "@/components/ContinuumSection";
import DeveloperWorkflow from "@/components/DeveloperWorkflow";
import FeatureSection from "@/components/FeatureCard";
import AgentSection from "@/components/AgentSection";
import ReliabilitySection from "@/components/ReliabilitySection";
import BenchmarksSection from "@/components/BenchmarksSection";
import FutureRoadmapSection from "@/components/FutureRoadmapSection";
import CodeDemo from "@/components/CodeDemo";
import DownloadsSection from "@/components/DownloadsSection";
import FAQAccordion from "@/components/FAQAccordion";
import CTASection from "@/components/CTASection";

export default function HomePage() {
  return (
    <div className="space-y-0 bg-[#050508]">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Trust & Product Signals */}
      <TrustBanner />

      {/* 3. Core Desktop IDE Workspace */}
      <IDECoreSection />

      {/* 4. Flagship Continuum Session Memory Section */}
      <ContinuumSection />

      {/* 5. 6-Stage Autonomous Engineering Lifecycle */}
      <DeveloperWorkflow />

      {/* 6. Core Engineering Intelligence (BDG, Patch Firewall, Verification, Safe Surgery, Truth Boundary) */}
      <FeatureSection />

      {/* 7. Autonomous AI Agent Mode & Safety */}
      <AgentSection />

      {/* 8. Workspace Snapshots & Rollback */}
      <ReliabilitySection />

      {/* 9. Performance & Subsystem Metrics */}
      <BenchmarksSection />

      {/* 10. Future Multi-Model & Infrastructure Roadmap */}
      <FutureRoadmapSection />

      {/* 11. Interactive Code Mutation & Verification Simulation */}
      <div className="py-14 bg-[#050508] border-b border-[#1f1f24]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span>INTERACTIVE PLAYGROUND</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
              Live AST Mutation &amp; Verification Simulation
            </h2>
          </div>
          <CodeDemo />
        </div>
      </div>

      {/* 12. Desktop Package Exploration */}
      <DownloadsSection />

      {/* 13. Technical FAQ Accordion */}
      <FAQAccordion />

      {/* 14. Final Conversion CTA */}
      <CTASection />
    </div>
  );
}
