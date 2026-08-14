"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  status: "running" | "exited" | "error";
  output: string[];
}

export function useTerminal(initialCwd: string = "") {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const tabsRef = useRef<TerminalTab[]>([]);
  tabsRef.current = tabs;

  // Listen to IPC stdout/stderr & exit events
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.terminal) return;

    const unbindData = window.electronAPI.terminal.onData(({ id, data }) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === id) {
            const lines = data.split("\n");
            const newOutput = [...tab.output];
            if (newOutput.length > 0 && !data.startsWith("\n") && !data.startsWith("\r")) {
              newOutput[newOutput.length - 1] += lines[0];
              newOutput.push(...lines.slice(1));
            } else {
              newOutput.push(...lines);
            }
            if (newOutput.length > 2000) {
              newOutput.splice(0, newOutput.length - 2000);
            }
            return { ...tab, output: newOutput };
          }
          return tab;
        })
      );
    });

    const unbindExit = window.electronAPI.terminal.onExit(({ id, exitCode }) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === id) {
            const status = exitCode === 0 ? "exited" : "error";
            return {
              ...tab,
              status,
              output: [...tab.output, `\n[Process exited with code ${exitCode}]`],
            };
          }
          return tab;
        })
      );
    });

    return () => {
      if (unbindData) unbindData();
      if (unbindExit) unbindExit();
    };
  }, []);

  const createTerminalTab = useCallback(async (cwdOverride?: string) => {
    if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.terminal) {
      // Fallback in non-Electron
      const fallbackId = `term-mock-${Date.now()}`;
      const newTab: TerminalTab = {
        id: fallbackId,
        name: `Terminal ${tabsRef.current.length + 1}`,
        cwd: cwdOverride || initialCwd || "~/workspace",
        status: "running",
        output: ["Echo Nullity Mock Terminal v1.0", "Type commands to simulate execution..."],
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(fallbackId);
      return fallbackId;
    }

    try {
      const res = await window.electronAPI.terminal.create({
        cwd: cwdOverride || initialCwd,
      });

      const newTab: TerminalTab = {
        id: res.id,
        name: `Terminal ${tabsRef.current.length + 1}`,
        cwd: res.cwd,
        status: "running",
        output: [],
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(res.id);
      return res.id;
    } catch (err: any) {
      console.error("[USE-TERMINAL] Failed to create terminal:", err);
      return null;
    }
  }, [initialCwd]);

  const closeTerminalTab = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.terminal) {
      try {
        await window.electronAPI.terminal.kill(id);
      } catch (e) {}
    }

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id && next.length > 0) {
        setActiveTabId(next[next.length - 1].id);
      } else if (next.length === 0) {
        setActiveTabId("");
      }
      return next;
    });
  }, [activeTabId]);

  const restartTerminalTab = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.terminal) {
      try {
        const res = await window.electronAPI.terminal.restart(id);
        setTabs((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "running", output: [] } : t))
        );
      } catch (e) {}
    }
  }, []);

  const sendTerminalInput = useCallback(async (id: string, input: string) => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.terminal) {
      try {
        await window.electronAPI.terminal.write(id, input);
      } catch (e) {}
    }
  }, []);

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    createTerminalTab,
    closeTerminalTab,
    restartTerminalTab,
    sendTerminalInput,
  };
}
