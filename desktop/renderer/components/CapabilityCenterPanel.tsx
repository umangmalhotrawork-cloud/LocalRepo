"use client";

import React, { useState } from "react";
import {
  Plug,
  Server,
  Sparkles,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  Code2,
  Trash2,
  Lock,
  Eye,
  Settings2,
} from "lucide-react";
import { useCapabilityCenter, MCPServerInfo, SkillInfo } from "../hooks/useCapabilityCenter";

interface CapabilityCenterPanelProps {
  workspacePath?: string;
  onClose?: () => void;
}

export default function CapabilityCenterPanel({
  workspacePath,
  onClose,
}: CapabilityCenterPanelProps) {
  const {
    servers,
    skills,
    capabilities,
    logs,
    configStatus,
    loading,
    selectedServerId,
    setSelectedServerId,
    startServer,
    stopServer,
    restartServer,
    enableSkill,
    disableSkill,
    reloadCapabilities,
    clearLogs,
  } = useCapabilityCenter(workspacePath);

  const [activeTab, setActiveTab] = useState<"servers" | "skills" | "logs">("servers");
  const [skillScopeFilter, setSkillScopeFilter] = useState<"ALL" | "PROJECT" | "BUILTIN">("ALL");
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    await reloadCapabilities();
    setTimeout(() => setIsReloading(false), 400);
  };

  const filteredSkills = skills.filter((s) => {
    if (skillScopeFilter === "PROJECT") return s.scope === "PROJECT" || s.source === "project";
    if (skillScopeFilter === "BUILTIN") return s.scope === "BUILTIN" || s.source === "builtin";
    return true;
  });

  const selectedServer = servers.find((s) => s.serverId === selectedServerId) || servers[0] || null;

  return (
    <div className="flex flex-col h-full bg-[#07070b] text-zinc-200 font-sans select-none overflow-hidden">
      {/* Header & Config State Summary */}
      <div className="p-3 border-b border-[#181824] bg-[#0a0a10] flex items-center justify-between shrink-0 font-mono">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
            <Plug className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Capability Operations</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                M15 Control Center
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center gap-2">
              <span>mcp.json:</span>
              <span
                className={`font-bold ${
                  configStatus.mcpStatus === "VALID"
                    ? "text-emerald-400"
                    : configStatus.mcpStatus === "INVALID"
                    ? "text-rose-400"
                    : "text-zinc-500"
                }`}
              >
                {configStatus.mcpStatus}
              </span>
              <span>• skills:</span>
              <span
                className={`font-bold ${
                  configStatus.skillsStatus === "DISCOVERED"
                    ? "text-purple-400"
                    : configStatus.skillsStatus === "INVALID_ENTRIES"
                    ? "text-amber-400"
                    : "text-zinc-500"
                }`}
              >
                {configStatus.skillsStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="p-1.5 rounded-lg bg-[#141420] hover:bg-[#1c1c2c] text-zinc-300 border border-[#242436] flex items-center gap-1 text-[11px] cursor-pointer transition-all hover:text-cyan-300"
            title="Hot Reload Capabilities from Disk"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Configuration Errors Banner (if any) */}
      {configStatus.errors.length > 0 && (
        <div className="px-3 py-2 bg-rose-950/40 border-b border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5 font-mono text-[10.5px]">
            <span className="font-bold text-rose-200">Configuration Issues Detected:</span>
            {configStatus.errors.map((err, idx) => (
              <div key={idx} className="text-rose-400 truncate">
                • {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#09090e] border-b border-[#141420] shrink-0 font-mono text-xs">
        <button
          onClick={() => setActiveTab("servers")}
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all ${
            activeTab === "servers"
              ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
          }`}
        >
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span>MCP Servers ({servers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("skills")}
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all ${
            activeTab === "skills"
              ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Skills ({skills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all ${
            activeTab === "logs"
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Operator Logs ({logs.length})</span>
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
        {/* ========================================================= */}
        {/* TAB 1: MCP SERVERS & TOOL INSPECTOR */}
        {/* ========================================================= */}
        {activeTab === "servers" && (
          <div className="space-y-3">
            {servers.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#1f1f2e] rounded-xl text-zinc-500 text-xs space-y-2">
                <Server className="w-8 h-8 text-zinc-600 mx-auto opacity-50" />
                <p>No MCP servers registered in current workspace.</p>
                <p className="text-[10px] text-zinc-600">
                  Declare servers in <code className="text-cyan-400">.nexus/mcp.json</code> to hydrate automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map((srv) => {
                  const isRunning = srv.status === "RUNNING";
                  const isStarting = srv.status === "STARTING";
                  const isFailed = srv.status === "FAILED";
                  const isSelected = selectedServer?.serverId === srv.serverId;

                  return (
                    <div
                      key={srv.serverId}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-[#0d0d16] border-cyan-500/40 shadow-lg shadow-cyan-950/20"
                          : "bg-[#090910] border-[#181826] hover:border-[#28283c]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          onClick={() => setSelectedServerId(srv.serverId)}
                        >
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning
                                ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse"
                                : isStarting
                                ? "bg-amber-400 animate-spin"
                                : isFailed
                                ? "bg-rose-500"
                                : "bg-zinc-600"
                            }`}
                          />
                          <span className="font-bold text-white text-xs truncate">{srv.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {srv.transport}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              isRunning
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                : isStarting
                                ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                                : isFailed
                                ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {srv.status}
                          </span>
                        </div>

                        {/* Lifecycle Control Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {(!isRunning && !isStarting) && (
                            <button
                              onClick={() => startServer(srv.serverId)}
                              className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 text-[10.5px] font-bold cursor-pointer transition-all"
                              title="Start Server"
                            >
                              <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                              <span>Start</span>
                            </button>
                          )}

                          {isRunning && (
                            <>
                              <button
                                onClick={() => restartServer(srv.serverId)}
                                className="p-1 rounded bg-[#141424] hover:bg-[#1f1f34] text-cyan-300 border border-[#24243a] cursor-pointer transition-all"
                                title="Restart Server"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => stopServer(srv.serverId)}
                                className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/30 flex items-center gap-1 text-[10.5px] font-bold cursor-pointer transition-all"
                                title="Stop Server"
                              >
                                <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                                <span>Stop</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Server Details & Error info */}
                      <div className="mt-1.5 text-[10px] text-zinc-500 flex items-center justify-between border-t border-[#141420] pt-1.5">
                        <div className="truncate">ID: <code className="text-zinc-400">{srv.serverId}</code></div>
                        <div>Tools: <span className="text-cyan-400 font-bold">{srv.tools?.length || srv.toolCount || 0}</span></div>
                      </div>

                      {srv.lastError && (
                        <div className="mt-1 text-[10px] text-rose-400 bg-rose-950/30 p-1.5 rounded border border-rose-500/20 truncate">
                          Error: {srv.lastError}
                        </div>
                      )}

                      {/* Exposed Tools Inspector */}
                      {isSelected && srv.tools && srv.tools.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-[#1a1a2c] space-y-1.5">
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Exposed Tools ({srv.tools.length})</span>
                            <span className="text-zinc-600">CapabilityRegistry Hydrated</span>
                          </div>
                          <div className="space-y-1">
                            {srv.tools.map((t) => (
                              <div
                                key={t.name}
                                className="p-1.5 rounded-lg bg-[#06060c] border border-[#181828] text-[10.5px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-cyan-300 flex items-center gap-1">
                                    <Code2 className="w-3 h-3 text-cyan-400" />
                                    {t.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {t.riskLevel && (
                                      <span
                                        className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${
                                          t.riskLevel === "SAFE"
                                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                                            : t.riskLevel === "REVIEW_REQUIRED"
                                            ? "bg-amber-950 text-amber-400 border border-amber-500/30"
                                            : "bg-rose-950 text-rose-400 border border-rose-500/30"
                                        }`}
                                      >
                                        {t.riskLevel}
                                      </span>
                                    )}
                                    {t.isReadOnly && (
                                      <span className="text-[8.5px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                        Read-Only
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-zinc-500 text-[9.5px] line-clamp-1">{t.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SKILL CENTER */}
        {/* ========================================================= */}
        {activeTab === "skills" && (
          <div className="space-y-3">
            {/* Scope Filter */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-zinc-500">Scope:</span>
              {(["ALL", "PROJECT", "BUILTIN"] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSkillScopeFilter(sc)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    skillScopeFilter === sc
                      ? "bg-purple-950 text-purple-300 font-bold border border-purple-500/30"
                      : "text-zinc-500 hover:text-zinc-300 bg-[#0d0d14]"
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>

            {filteredSkills.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#1f1f2e] rounded-xl text-zinc-500 text-xs">
                No skills matching scope filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSkills.map((sk) => {
                  const isActive = sk.status === "ACTIVE" && sk.enabled;
                  const isBuiltin = sk.scope === "BUILTIN" || sk.source === "builtin";

                  return (
                    <div
                      key={sk.skillId}
                      className="p-2.5 rounded-xl bg-[#090910] border border-[#181826] hover:border-[#28283c] transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive ? "bg-purple-400 shadow-sm shadow-purple-400/40" : "bg-zinc-600"
                            }`}
                          />
                          <span className="font-bold text-white text-xs truncate">{sk.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            v{sk.version}
                          </span>
                          <span
                            className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${
                              isBuiltin
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                                : "bg-purple-950 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {sk.scope}
                          </span>
                        </div>

                        {/* Skill Toggle Button */}
                        <div>
                          <button
                            onClick={() => (isActive ? disableSkill(sk.skillId) : enableSkill(sk.skillId))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              isActive
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
                            }`}
                          >
                            {isActive ? "ACTIVE" : "DISABLED"}
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-400 line-clamp-2">{sk.description}</div>

                      {/* Triggers & Dependencies Badges */}
                      <div className="flex flex-wrap items-center gap-1 text-[9px] pt-1">
                        {sk.triggers?.map((trig, idx) => (
                          <span key={idx} className="px-1.5 py-0.2 rounded bg-[#12121e] text-zinc-400 border border-[#202034]">
                            #{trig}
                          </span>
                        ))}
                        {sk.requires && sk.requires.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
                            requires: {sk.requires.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: OPERATOR LOGS */}
        {/* ========================================================= */}
        {activeTab === "logs" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pb-1 border-b border-[#141420]">
              <span>Real-time Capability Event Stream (Sanitized)</span>
              <button
                onClick={clearLogs}
                className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                title="Clear Logs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-xs">No capability logs captured yet.</div>
            ) : (
              <div className="space-y-1 font-mono text-[10px]">
                {logs.map((lg) => (
                  <div
                    key={lg.id}
                    className="p-1.5 rounded-md bg-[#08080f] border border-[#141420] flex items-start gap-2 text-zinc-300 leading-relaxed"
                  >
                    <span className="text-zinc-600 shrink-0">
                      {new Date(lg.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`px-1 rounded text-[8.5px] font-bold shrink-0 ${
                        lg.status === "SUCCESS"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                          : lg.status === "ERROR"
                          ? "bg-rose-950 text-rose-400 border border-rose-500/30"
                          : lg.status === "WARN"
                          ? "bg-amber-950 text-amber-400 border border-amber-500/30"
                          : "bg-cyan-950 text-cyan-400 border border-cyan-500/30"
                      }`}
                    >
                      {lg.status}
                    </span>
                    <span className="text-zinc-300 break-all flex-1">{lg.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
