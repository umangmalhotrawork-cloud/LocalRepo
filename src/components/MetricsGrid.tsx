"use client";

import { motion } from "framer-motion";
import { Gauge, ShieldAlert, Cpu, Activity, Clock, RefreshCw } from "lucide-react";
import Sparkline from "@/components/ui/Sparkline";

interface MetricItem {
  label: string;
  value: string;
  sub: string;
  icon: any;
  color: string;
  sparklineData: number[];
  sparklineColor: string;
}

const metrics: MetricItem[] = [
  {
    label: "Ghost Code Ratio",
    value: "14%",
    sub: "Average AI bloat detected",
    icon: ShieldAlert,
    color: "text-amber-400",
    sparklineData: [5, 9, 12, 14, 18, 14, 14],
    sparklineColor: "#f59e0b",
  },
  {
    label: "Verified Null Lines",
    value: "312",
    sub: "Causally vacuous LOC",
    icon: Activity,
    color: "text-cyan-400",
    sparklineData: [80, 140, 210, 260, 312],
    sparklineColor: "#22d3ee",
  },
  {
    label: "Redundant Clusters",
    value: "9",
    sub: "Cross-file duplicate logic",
    icon: Cpu,
    color: "text-purple-400",
    sparklineData: [2, 4, 6, 8, 9],
    sparklineColor: "#8b5cf6",
  },
  {
    label: "Semantic Compression",
    value: "7.5×",
    sub: "Codebase leverage ratio",
    icon: Gauge,
    color: "text-emerald-400",
    sparklineData: [2.1, 3.8, 5.2, 6.4, 7.5],
    sparklineColor: "#10b981",
  },
  {
    label: "Rollback Time",
    value: "<1s",
    sub: "Instant restoration guarantee",
    icon: RefreshCw,
    color: "text-blue-400",
    sparklineData: [3.2, 1.8, 1.1, 0.8, 0.4],
    sparklineColor: "#3b82f6",
  },
  {
    label: "Scan Time",
    value: "<5s",
    sub: "10,000 LOC repository scan",
    icon: Clock,
    color: "text-teal-400",
    sparklineData: [12.4, 8.2, 6.1, 4.8, 4.2],
    sparklineColor: "#14b8a6",
  },
];

export default function MetricsGrid() {
  return (
    <section className="py-20 bg-[#000000] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <span>REPOSITORY BENCHMARK ANALYTICS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight">
            Empirical Software Measurements
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Benchmarked against AI-generated codebases across Python, C++, and Rust.
          </p>
        </div>

        {/* 6 Metrics Grid with SVG Sparklines */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 rounded-24 p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-cyan-glow"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-zinc-400 font-medium">
                    {item.label}
                  </span>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>

                <div className="space-y-2">
                  <div className={`text-3xl font-extrabold font-mono tracking-tight ${item.color}`}>
                    {item.value}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {item.sub}
                  </p>
                </div>

                {/* SVG Sparkline Graph */}
                <div className="pt-3 mt-2 border-t border-[#181818] flex justify-end">
                  <Sparkline
                    data={item.sparklineData}
                    color={item.sparklineColor}
                    width={100}
                    height={24}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
