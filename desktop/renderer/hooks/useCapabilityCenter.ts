"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface MCPServerInfo {
  serverId: string;
  name: string;
  transport: string;
  status: "REGISTERED" | "STARTING" | "RUNNING" | "STOPPED" | "FAILED";
  enabled: boolean;
  source: string;
  toolCount: number;
  tools?: Array<{
    name: string;
    description: string;
    riskLevel?: string;
    requiresApproval?: boolean | string;
    isReadOnly?: boolean;
    allowMutation?: boolean;
    inputSchema?: any;
  }>;
  startedAt?: number | null;
  lastError?: string | null;
  policy?: { networkAllowed?: boolean; allowedCwd?: string | null };
  metadata?: any;
}

export interface SkillInfo {
  skillId: string;
  name: string;
  version: string;
  description: string;
  source: string;
  scope: "BUILTIN" | "PROJECT" | "SUBAGENT";
  status: "ACTIVE" | "DISABLED" | "INVALID" | "STALE";
  triggers: string[];
  allowedTools?: string[] | null;
  constraints?: string[];
  requires?: string[];
  enabled: boolean;
  configHash?: string;
  loadedAt?: number;
}

export interface CapabilityLogEntry {
  id: string;
  timestamp: number;
  type: string;
  serverId?: string;
  toolName?: string;
  status: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
  details?: any;
}

export interface ProjectConfigStatus {
  mcpStatus: "VALID" | "INVALID" | "NOT_FOUND";
  skillsStatus: "DISCOVERED" | "EMPTY" | "INVALID_ENTRIES";
  errors: string[];
  warnings: string[];
  lastDiscoveredAt?: number;
}

export function useCapabilityCenter(workspacePath?: string) {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [logs, setLogs] = useState<CapabilityLogEntry[]>([]);
  const [configStatus, setConfigStatus] = useState<ProjectConfigStatus>({
    mcpStatus: "NOT_FOUND",
    skillsStatus: "EMPTY",
    errors: [],
    warnings: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const logsRef = useRef<CapabilityLogEntry[]>([]);
  logsRef.current = logs;

  const appendLog = useCallback((entry: Omit<CapabilityLogEntry, "id" | "timestamp">) => {
    const newEntry: CapabilityLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 99)]); // Keep last 100 entries, newest first
  }, []);

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).electronAPI?.harness) {
      return;
    }
    const harness = (window as any).electronAPI.harness;

    try {
      setLoading(true);
      const [fetchedServers, fetchedSkills, fetchedCaps] = await Promise.all([
        harness.getMCPServers ? harness.getMCPServers().catch(() => []) : [],
        harness.getSkills ? harness.getSkills().catch(() => []) : [],
        harness.getCapabilities ? harness.getCapabilities().catch(() => []) : [],
      ]);

      if (Array.isArray(fetchedServers)) {
        // Enforce tools population
        const serversWithTools = await Promise.all(
          fetchedServers.map(async (s: MCPServerInfo) => {
            if (!s.tools && harness.getMCPServerTools) {
              const tools = await harness.getMCPServerTools(s.serverId).catch(() => []);
              return { ...s, tools };
            }
            return s;
          })
        );
        setServers(serversWithTools);
      }

      if (Array.isArray(fetchedSkills)) {
        setSkills(fetchedSkills);
      }

      if (Array.isArray(fetchedCaps)) {
        setCapabilities(fetchedCaps);
      }

      if (workspacePath && harness.getProjectCapabilityStatus) {
        const disc = await harness.getProjectCapabilityStatus(workspacePath).catch(() => null);
        if (disc) {
          setConfigStatus({
            mcpStatus: disc.hasMCPConfig ? "VALID" : disc.exists ? "NOT_FOUND" : "NOT_FOUND",
            skillsStatus: disc.skillFiles?.length > 0 ? "DISCOVERED" : "EMPTY",
            errors: [],
            warnings: [],
            lastDiscoveredAt: Date.now(),
          });
        }
      }
    } catch (err: any) {
      appendLog({
        type: "FETCH_ERROR",
        status: "ERROR",
        message: `Failed to refresh capabilities: ${err.message || "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  }, [workspacePath, appendLog]);

  useEffect(() => {
    refreshState();

    if (typeof window === "undefined" || !(window as any).electronAPI?.harness?.onEvent) {
      return;
    }

    const unsub = (window as any).electronAPI.harness.onEvent((event: any) => {
      if (!event || !event.type) return;

      switch (event.type) {
        case "MCP_SERVER_STARTED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            status: "SUCCESS",
            message: `MCP Server "${event.payload?.name || event.payload?.serverId}" started (${event.payload?.toolCount || 0} tools)`,
          });
          refreshState();
          break;

        case "MCP_SERVER_STOPPED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            status: "INFO",
            message: `MCP Server "${event.payload?.name || event.payload?.serverId}" stopped`,
          });
          refreshState();
          break;

        case "MCP_SERVER_FAILED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            status: "ERROR",
            message: `MCP Server "${event.payload?.serverId}" failed: ${event.payload?.error || "Unknown error"}`,
          });
          refreshState();
          break;

        case "EXTERNAL_TOOL_STARTED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            toolName: event.payload?.toolName,
            status: "INFO",
            message: `Executing tool "${event.payload?.toolName}"`,
          });
          break;

        case "EXTERNAL_TOOL_COMPLETED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            toolName: event.payload?.toolName,
            status: "SUCCESS",
            message: `Tool "${event.payload?.toolName}" completed successfully`,
          });
          break;

        case "EXTERNAL_TOOL_FAILED":
          appendLog({
            type: event.type,
            serverId: event.payload?.serverId,
            toolName: event.payload?.toolName,
            status: "ERROR",
            message: `Tool "${event.payload?.toolName}" failed: ${event.payload?.error || "Error"}`,
          });
          break;

        case "SKILL_DISCOVERED":
        case "SKILL_RELOADED":
          appendLog({
            type: event.type,
            status: "INFO",
            message: `Skill "${event.payload?.name || event.payload?.skillId}" ${event.type === "SKILL_RELOADED" ? "reloaded" : "discovered"}`,
          });
          refreshState();
          break;

        case "SKILL_LOAD_FAILED":
          appendLog({
            type: event.type,
            status: "WARN",
            message: `Skill load failed: ${event.payload?.error || "Syntax error"}`,
          });
          setConfigStatus((prev) => ({
            ...prev,
            skillsStatus: "INVALID_ENTRIES",
            errors: [...prev.errors, event.payload?.error || "Skill syntax error"],
          }));
          break;

        case "PROJECT_CAPABILITIES_DISCOVERED":
          if (event.payload?.errors?.length > 0) {
            setConfigStatus({
              mcpStatus: "INVALID",
              skillsStatus: event.payload.skillCount > 0 ? "DISCOVERED" : "EMPTY",
              errors: event.payload.errors,
              warnings: event.payload.warnings || [],
              lastDiscoveredAt: Date.now(),
            });
          } else {
            setConfigStatus({
              mcpStatus: "VALID",
              skillsStatus: event.payload.skillCount > 0 ? "DISCOVERED" : "EMPTY",
              errors: [],
              warnings: event.payload.warnings || [],
              lastDiscoveredAt: Date.now(),
            });
          }
          refreshState();
          break;

        case "PROJECT_CAPABILITY_CONFIG_INVALID":
          setConfigStatus((prev) => ({
            ...prev,
            mcpStatus: "INVALID",
            errors: [...prev.errors, event.payload?.error || "Invalid mcp.json"],
          }));
          appendLog({
            type: event.type,
            status: "ERROR",
            message: `Config error: ${event.payload?.error || "Invalid configuration"}`,
          });
          break;

        default:
          break;
      }
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [refreshState, appendLog]);

  // Actions
  const startServer = async (serverId: string) => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.startMCPServer) {
      appendLog({ type: "START_SERVER", serverId, status: "INFO", message: `Starting server ${serverId}...` });
      try {
        await harness.startMCPServer(serverId);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "START_FAILED", serverId, status: "ERROR", message: err.message });
      }
    }
  };

  const stopServer = async (serverId: string) => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.stopMCPServer) {
      appendLog({ type: "STOP_SERVER", serverId, status: "INFO", message: `Stopping server ${serverId}...` });
      try {
        await harness.stopMCPServer(serverId);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "STOP_FAILED", serverId, status: "ERROR", message: err.message });
      }
    }
  };

  const restartServer = async (serverId: string) => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.restartMCPServer) {
      appendLog({ type: "RESTART_SERVER", serverId, status: "INFO", message: `Restarting server ${serverId}...` });
      try {
        await harness.restartMCPServer(serverId);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "RESTART_FAILED", serverId, status: "ERROR", message: err.message });
      }
    }
  };

  const enableSkill = async (skillId: string) => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.enableSkill) {
      try {
        await harness.enableSkill(skillId);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "SKILL_ERROR", status: "ERROR", message: err.message });
      }
    }
  };

  const disableSkill = async (skillId: string) => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.disableSkill) {
      try {
        await harness.disableSkill(skillId);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "SKILL_ERROR", status: "ERROR", message: err.message });
      }
    }
  };

  const reloadCapabilities = async () => {
    const harness = (window as any).electronAPI?.harness;
    if (harness?.reloadProjectCapabilities && workspacePath) {
      appendLog({ type: "RELOAD", status: "INFO", message: "Reloading project capabilities from disk..." });
      try {
        await harness.reloadProjectCapabilities(workspacePath);
        await refreshState();
      } catch (err: any) {
        appendLog({ type: "RELOAD_FAILED", status: "ERROR", message: err.message });
      }
    } else {
      await refreshState();
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return {
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
    refreshState,
  };
}
