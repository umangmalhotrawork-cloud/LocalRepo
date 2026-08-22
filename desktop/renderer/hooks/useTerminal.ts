"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  shell?: string;
  status: "running" | "exited" | "error";
  exitCode?: number | null;
  output: string[];
  unread?: boolean;
  createdAt?: number;
}

export type SplitLayout = null | "vertical" | "horizontal";

export function useTerminal(initialCwd: string = "") {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [splitLayout, setSplitLayout] = useState<SplitLayout>(null);
  const [splitTabIds, setSplitTabIds] = useState<string[]>([]);
  const [focusedPaneId, setFocusedPaneId] = useState<string>("");

  const tabsRef = useRef<TerminalTab[]>([]);
  tabsRef.current = tabs;

  const activeTabIdRef = useRef<string>(activeTabId);
  activeTabIdRef.current = activeTabId;

  const splitTabIdsRef = useRef<string[]>(splitTabIds);
  splitTabIdsRef.current = splitTabIds;

  // Hydrate existing backend sessions on initial mount if available
  useEffect(() => {
    if (typeof window === "undefined") return;
    const termApi = (window as any).electronAPI?.terminal;
    if (!termApi || typeof termApi.list !== "function") return;

    let isMounted = true;
    (async () => {
      try {
        const backendList = await termApi.list();
        if (isMounted && Array.isArray(backendList) && backendList.length > 0 && tabsRef.current.length === 0) {
          const hydratedTabs: TerminalTab[] = await Promise.all(
            backendList.map(async (item: any) => {
              let buffer: string[] = [];
              try {
                const bufRes = await termApi.getBuffer?.(item.id);
                if (bufRes && Array.isArray(bufRes.buffer)) {
                  buffer = bufRes.buffer;
                }
              } catch (e) {}

              return {
                id: item.id,
                name: item.name || `Terminal ${item.id}`,
                cwd: item.cwd || initialCwd || process.cwd(),
                shell: item.shell,
                status: item.status || "running",
                exitCode: item.exitCode,
                output: buffer,
                unread: false,
                createdAt: item.createdAt || Date.now(),
              };
            })
          );

          if (isMounted && hydratedTabs.length > 0) {
            setTabs(hydratedTabs);
            setActiveTabId(hydratedTabs[0].id);
            setFocusedPaneId(hydratedTabs[0].id);
          }
        }
      } catch (err) {
        console.warn("[USE-TERMINAL] Error hydrating backend sessions:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialCwd]);

  // Listen to IPC stdout/stderr, exit & status events
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

            const isVisible =
              tab.id === activeTabIdRef.current || splitTabIdsRef.current.includes(tab.id);

            return {
              ...tab,
              output: newOutput,
              unread: !isVisible ? true : tab.unread,
            };
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
              exitCode,
              output: [...tab.output, `\n[Process exited with code ${exitCode}]`],
            };
          }
          return tab;
        })
      );
    });

    const unbindStatus = (window.electronAPI.terminal as any).onStatus?.(({ id, status, exitCode }: any) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === id) {
            return {
              ...tab,
              status: status || tab.status,
              exitCode: exitCode !== undefined ? exitCode : tab.exitCode,
            };
          }
          return tab;
        })
      );
    });

    return () => {
      if (unbindData) unbindData();
      if (unbindExit) unbindExit();
      if (unbindStatus) unbindStatus();
    };
  }, []);

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id);
    setFocusedPaneId(id);
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false } : t))
    );
  }, []);

  const createTerminalTab = useCallback(
    async (cwdOverride?: string, shellOverride?: string, nameOverride?: string) => {
      if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.terminal) {
        // Fallback in non-Electron
        const fallbackId = `term-mock-${Date.now()}`;
        const newTab: TerminalTab = {
          id: fallbackId,
          name: nameOverride || `Terminal ${tabsRef.current.length + 1}`,
          cwd: cwdOverride || initialCwd || "~/workspace",
          shell: shellOverride || "/bin/sh",
          status: "running",
          output: ["NEXUS Mock Terminal v1.0", "Type commands to simulate execution..."],
          unread: false,
          createdAt: Date.now(),
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(fallbackId);
        setFocusedPaneId(fallbackId);
        return fallbackId;
      }

      try {
        const sessionName = nameOverride || `Terminal ${tabsRef.current.length + 1}`;
        const res = await (window as any).electronAPI.terminal.create({
          cwd: cwdOverride || initialCwd,
          shell: shellOverride,
          name: sessionName,
        });

        const newTab: TerminalTab = {
          id: res.id,
          name: res.name || sessionName,
          cwd: res.cwd,
          shell: res.shell,
          status: "running",
          output: [],
          unread: false,
          createdAt: res.createdAt || Date.now(),
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(res.id);
        setFocusedPaneId(res.id);
        return res.id;
      } catch (err: any) {
        console.error("[USE-TERMINAL] Failed to create terminal:", err);
        const errorTabId = `term-err-${Date.now()}`;
        const newTab: TerminalTab = {
          id: errorTabId,
          name: nameOverride || `Terminal ${tabsRef.current.length + 1} (Error)`,
          cwd: cwdOverride || initialCwd || "~",
          shell: shellOverride,
          status: "error",
          output: [
            `[TERMINAL ERROR] Failed to spawn shell session.`,
            `Details: ${err.message || String(err)}`,
            `Tip: Verify shell executable exists and has valid execution permissions.`,
          ],
          unread: false,
          createdAt: Date.now(),
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(errorTabId);
        setFocusedPaneId(errorTabId);
        return null;
      }
    },
    [initialCwd]
  );

  const closeTerminalTab = useCallback(
    async (id: string) => {
      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.terminal) {
        try {
          await window.electronAPI.terminal.kill(id);
        } catch (e) {}
      }

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeTabIdRef.current === id && next.length > 0) {
          const nextActive = next[next.length - 1].id;
          setActiveTabId(nextActive);
          setFocusedPaneId(nextActive);
        } else if (next.length === 0) {
          setActiveTabId("");
          setFocusedPaneId("");
          setSplitLayout(null);
          setSplitTabIds([]);
        }
        return next;
      });

      // Update split view if closed tab was in split
      setSplitTabIds((prev) => {
        const updated = prev.filter((tid) => tid !== id);
        if (updated.length <= 1) {
          setSplitLayout(null);
        }
        return updated;
      });
    },
    []
  );

  const renameTab = useCallback(
    async (id: string, newName: string) => {
      if (!newName || !newName.trim()) return;
      const trimmed = newName.trim();

      if (typeof window !== "undefined" && (window as any).electronAPI?.terminal?.rename) {
        try {
          await (window as any).electronAPI.terminal.rename(id, trimmed);
        } catch (e) {}
      }

      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t))
      );
    },
    []
  );

  const clearTabOutput = useCallback(
    async (id: string) => {
      if (typeof window !== "undefined" && (window as any).electronAPI?.terminal?.clear) {
        try {
          await (window as any).electronAPI.terminal.clear(id);
        } catch (e) {}
      }

      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, output: [] } : t))
      );
    },
    []
  );

  const restartTerminalTab = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.terminal) {
      try {
        await window.electronAPI.terminal.restart(id);
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

  const appendOutputToTab = useCallback((id: string, text: string) => {
    if (!text) return;
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === id) {
          const splitLines = text.replace(/\r\n/g, "\n").split("\n");
          if (splitLines.length > 1 && splitLines[splitLines.length - 1] === "") {
            splitLines.pop();
          }
          const updatedOutput = [...tab.output, ...splitLines];
          if (updatedOutput.length > 2000) {
            updatedOutput.splice(0, updatedOutput.length - 2000);
          }
          return { ...tab, output: updatedOutput };
        }
        return tab;
      })
    );
  }, []);

  // Split Pane Management
  const splitTab = useCallback(
    async (direction: "vertical" | "horizontal" = "vertical", targetTabId?: string) => {
      const currentActiveId = activeTabIdRef.current;
      if (!currentActiveId && tabsRef.current.length === 0) {
        const newId = await createTerminalTab();
        if (newId) {
          setActiveTabId(newId);
          setFocusedPaneId(newId);
        }
        return;
      }

      let secondTabId = targetTabId;
      if (!secondTabId) {
        // Look for an existing unused tab or spawn a new one
        const unused = tabsRef.current.find(
          (t) => t.id !== currentActiveId && !splitTabIdsRef.current.includes(t.id)
        );
        if (unused) {
          secondTabId = unused.id;
        } else {
          const created = await createTerminalTab();
          if (created) {
            secondTabId = created;
          }
        }
      }

      if (secondTabId && currentActiveId) {
        setSplitLayout(direction);
        setSplitTabIds([currentActiveId, secondTabId]);
        setFocusedPaneId(secondTabId);
      }
    },
    [createTerminalTab]
  );

  const unsplit = useCallback(() => {
    setSplitLayout(null);
    setSplitTabIds([]);
    if (focusedPaneId) {
      setActiveTabId(focusedPaneId);
    }
  }, [focusedPaneId]);

  const focusPane = useCallback((id: string) => {
    setFocusedPaneId(id);
    setActiveTabId(id);
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false } : t))
    );
  }, []);

  return {
    tabs,
    activeTabId,
    setActiveTabId: selectTab,
    createTerminalTab,
    closeTerminalTab,
    renameTab,
    clearTabOutput,
    restartTerminalTab,
    sendTerminalInput,
    appendOutputToTab,
    splitLayout,
    setSplitLayout,
    splitTabIds,
    setSplitTabIds,
    focusedPaneId,
    setFocusedPaneId: focusPane,
    splitTab,
    unsplit,
  };
}
