import Hero from "@/components/Hero";
import CodeDemo from "@/components/CodeDemo";
import FeatureSection from "@/components/FeatureCard";
import ArchitectureFlow from "@/components/ArchitectureFlow";
import TensionGraph from "@/components/TensionGraph";
import MetricsGrid from "@/components/MetricsGrid";
import ResearchSection from "@/components/ResearchSection";
import DeveloperWorkflow from "@/components/DeveloperWorkflow";
import OpenSourceRepo from "@/components/OpenSourceRepo";
import FAQAccordion from "@/components/FAQAccordion";
import CTASection from "@/components/CTASection";

import SectionReveal from "@/components/ui/SectionReveal";
import CodeTransition from "@/components/ui/CodeTransition";

export default function HomePage() {
  return (
    <div className="space-y-4">
      {/* 1. Hero Section */}
      <SectionReveal label="TOMOGRAPHY ENGINE STARTUP">
        <Hero />
      </SectionReveal>

      <CodeTransition lines={[
        "> initializing Tree-sitter multi-language parser...",
        "> detecting identity operation patterns...",
        "> computing path condition collapse...",
        "> ready for interactive tomography analysis...",
      ]} />

      {/* 2. Interactive Code Demo */}
      <SectionReveal label="INTERACTIVE AST SURGERY">
        <CodeDemo />
      </SectionReveal>

      <CodeTransition lines={[
        "> constructing Control Flow Graph (CFG)...",
        "> resolving value propagation paths (DFG)...",
        "> tagging 0.00 Causal Luminance nodes...",
        "> isolating pure computational statements...",
      ]} />

      {/* 3. Core Instrumentation Feature Cards */}
      <SectionReveal label="SEMANTIC INSTRUMENTATION">
        <FeatureSection />
      </SectionReveal>

      <CodeTransition lines={[
        "> running petgraph AST graph traversals...",
        "> calculating Zhang-Shasha Tree Edit Distances...",
        "> building cross-module tension matrix...",
        "> grouping redundant logic clusters...",
      ]} />

      {/* 4. Analysis Pipeline Flow */}
      <SectionReveal label="RUST ENGINE PIPELINE">
        <ArchitectureFlow />
      </SectionReveal>

      <CodeTransition lines={[
        "> evaluating cross-file semantic equivalence...",
        "> identifying AI-generated duplicate patterns...",
        "> clustering tension score > 0.85...",
        "> preparing force-directed node visualization...",
      ]} />

      {/* 5. Semantic Tension Graph */}
      <SectionReveal label="EQUIVALENCE CLUSTERING">
        <TensionGraph />
      </SectionReveal>

      <CodeTransition lines={[
        "> compiling empirical software metrics...",
        "> validating NullBench 200 function dataset...",
        "> measuring 10k LOC scan latency (<5.0s)...",
        "> verifying sub-second rollback restoration...",
      ]} />

      {/* 6. Metrics Grid */}
      <SectionReveal label="EMPIRICAL METRICS">
        <MetricsGrid />
      </SectionReveal>

      <CodeTransition lines={[
        "> loading PLDI / ICSE academic paper specification...",
        "> exporting BibTeX citation metadata...",
        "> verifying local-first privacy sandbox policy...",
        "> ready for peer review evaluation...",
      ]} />

      {/* 7. Research Section */}
      <SectionReveal label="ACADEMIC CONTRIBUTIONS">
        <ResearchSection />
      </SectionReveal>

      {/* 8. Developer Workflow */}
      <SectionReveal label="ENGINEERING INTEGRATION">
        <DeveloperWorkflow />
      </SectionReveal>

      {/* 9. Open Source Repo */}
      <SectionReveal label="OPEN SOURCE MIT">
        <OpenSourceRepo />
      </SectionReveal>

      {/* 10. FAQ Accordion */}
      <SectionReveal label="FREQUENTLY ASKED QUESTIONS">
        <FAQAccordion />
      </SectionReveal>

      {/* 11. Final CTA */}
      <SectionReveal label="GET STARTED">
        <CTASection />
      </SectionReveal>
    </div>
  );
}
