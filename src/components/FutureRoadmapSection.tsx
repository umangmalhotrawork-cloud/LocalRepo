"use client";

import React from "react";
import { Cpu, MessageSquare, Database, Cloud, Sparkles, Layers, ArrowRight, ShieldCheck } from "lucide-react";

export default function FutureRoadmapSection() {
  const modelProviders = [
    { name: "Gemini", desc: "Google DeepMind frontier models" },
    { name: "Claude", desc: "Anthropic reasoning & code models" },
    { name: "OpenAI / GPT", desc: "GPT-4o & o1 reasoning models" },
    { name: "Grok", desc: "xAI high-throughput models" },
    { name: "DeepSeek", desc: "Open-weights engineering models" },
  ];

  const dbIntegrations = [
    { name: "Supabase", type: "Postgres & Auth" },
    { name: "MongoDB", type: "Document Store" },
    { name: "PostgreSQL", type: "Relational Database" },
  ];

  const deploymentIntegrations = [
    { name: "Vercel", target: "Frontend & Serverless" },
    { name: "Render", target: "Backend Services" },
    { name: "Netlify", target: "Edge & Web Apps" },
  ];

  return (
    <section id="roadmap" className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>ROADMAP &amp; EXPANDING INFRASTRUCTURE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Future Multi-Model &amp; Infrastructure Roadmap
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-3xl leading-relaxed">
            As NEXUS evolves, we are expanding our model ecosystem and optional infrastructure connections while keeping your local workspace authoritative.
          </p>

          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-[11px] font-sans flex items-center gap-2 max-w-3xl">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Roadmap Preview: The capabilities below represent planned architecture directions. Local workspace editing remains the core authoritative foundation.</span>
          </div>
        </div>

        {/* 4 Cards Grid for Roadmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. Multi-Model Ecosystem */}
          <div className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-zinc-100 text-sm">Multi-Model AI Ecosystem</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                Future / Roadmap
              </span>
            </div>

            <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">
              Future releases will support BYO-Key multi-provider switching. Select your preferred provider and model directly within the NEXUS agent environment.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10.5px]">
              {modelProviders.map((mp, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#050508] border border-[#181820]">
                  <div className="text-cyan-300 font-bold">{mp.name}</div>
                  <div className="text-[10px] text-zinc-500 font-sans">{mp.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Multi-Chat Memory */}
          <div className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-zinc-100 text-sm">Multi-Chat &amp; Session Threads</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40">
                Future / Roadmap
              </span>
            </div>

            <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">
              &quot;Move between projects, conversations, and engineering sessions without losing the thread.&quot; Dedicated persistent threads tied directly to Continuum context.
            </p>

            <ul className="space-y-2 text-[11px] font-sans text-zinc-300 pt-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Persistent project conversations across sessions</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Model-specific chats &amp; sub-task branching</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Continuum-powered conversation handoff</span>
              </li>
            </ul>
          </div>

          {/* 3. Database Connectivity */}
          <div className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-zinc-100 text-sm">Database Infrastructure Connections</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                Future Integration
              </span>
            </div>

            <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">
              &quot;Connect the infrastructure your project already uses.&quot; Connect optional cloud databases to inspect schema definitions and migrations directly within your local workspace.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10.5px]">
              {dbIntegrations.map((db, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#050508] border border-[#181820] text-center">
                  <div className="text-emerald-300 font-bold">{db.name}</div>
                  <div className="text-[9.5px] text-zinc-500 font-sans">{db.type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Deployment Integrations */}
          <div className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-zinc-100 text-sm">Deployment &amp; Cloud Infrastructure</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                Future Integration
              </span>
            </div>

            <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">
              &quot;From local engineering workspace to production infrastructure.&quot; Optional deployment connections linking local builds to external cloud hosting.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10.5px]">
              {deploymentIntegrations.map((dep, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#050508] border border-[#181820] text-center">
                  <div className="text-amber-300 font-bold">{dep.name}</div>
                  <div className="text-[9.5px] text-zinc-500 font-sans">{dep.target}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
