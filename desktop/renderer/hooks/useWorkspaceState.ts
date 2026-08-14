"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface EditorViewState {
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface WorkspacePersistedState {
  folderPath: string;
  openTabs: Array<{ path: string; name: string }>;
  activeTabPath: string;
  mainView: "editor" | "dashboard" | "graph" | "clones" | "semantic_clones" | "luminance" | "behavior_fingerprint" | "patch_firewall" | "repository_patch_firewall" | "semantic_intent_radar" | "source_control" | "search" | "test_explorer" | "profiler" | "security_audit" | "snapshots";
  explorerWidth: number;
  analysisWidth: number;
  consoleHeight: number;
  editorStates?: Record<string, EditorViewState>;
  timestamp?: number;
}

export type RecoverySnapshot = {
  workspacePath: string;
  savedAt?: number;
  appVersion?: string;
  openTabs: Array<{
    path: string;
    content: string;
    isDirty: boolean;
    cursor?: {
      line: number;
      column: number;
    };
    scrollTop?: number;
  }>;
  activeTabPath: string | null;
};

const LOCAL_STORAGE_KEY = "echo_workspace_state";

export function useWorkspaceState() {
  const [loadedState, setLoadedState] = useState<WorkspacePersistedState | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<WorkspacePersistedState | null>(null);
  const lastSavedStringRef = useRef<string>("");

  // Recovery autosave refs
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRecoveryRef = useRef<RecoverySnapshot | null>(null);
  const lastRecoveryHashRef = useRef<string>("");

  // Flush recovery snapshot immediately
  const flushRecoverySnapshot = useCallback(async () => {
    const snap = pendingRecoveryRef.current;
    if (!snap || !snap.workspacePath) return;

    const dirtyTabs = (snap.openTabs || []).filter((t) => t.isDirty);
    if (dirtyTabs.length === 0) {
      if (typeof window !== "undefined" && (window as any).electronAPI?.recovery?.clear) {
        try {
          await (window as any).electronAPI.recovery.clear(snap.workspacePath);
        } catch (e) {}
      }
      return;
    }

    if (typeof window !== "undefined" && (window as any).electronAPI?.recovery?.save) {
      try {
        await (window as any).electronAPI.recovery.save({
          workspacePath: snap.workspacePath,
          snapshot: snap,
        });
        console.log("[RECOVERY] Snapshot saved to disk");
      } catch (err) {
        console.error("[RECOVERY] Error saving snapshot:", err);
      }
    }
  }, []);

  // Window blur & beforeunload listeners for instantaneous snapshot flush
  useEffect(() => {
    const handleFlush = () => {
      flushRecoverySnapshot();
    };

    window.addEventListener("blur", handleFlush);
    window.addEventListener("beforeunload", handleFlush);

    return () => {
      window.removeEventListener("blur", handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
    };
  }, [flushRecoverySnapshot]);

  // 1. Load state on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeState() {
      let state: WorkspacePersistedState | null = null;

      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.loadWorkspaceState) {
        try {
          state = await window.electronAPI.loadWorkspaceState();
        } catch (err) {
          console.error("[STATE-HOOK] Failed to load workspace state from Electron:", err);
        }
      }

      if (!state && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (raw) {
            state = JSON.parse(raw);
          }
        } catch (err) {
          console.warn("[STATE-HOOK] Failed to parse state from localStorage:", err);
        }
      }

      if (isMounted) {
        if (state) {
          console.log("[STATE] loaded", state);
          setLoadedState(state);
        } else {
          console.log("[STATE] loaded null (fresh session)");
        }
        setHasLoaded(true);
      }
    }

    initializeState();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  // 2. Debounced save function for workspace settings
  const requestSave = useCallback((state: WorkspacePersistedState) => {
    if (!state || !state.folderPath) return;

    const serialized = JSON.stringify({
      folderPath: state.folderPath,
      openTabs: state.openTabs,
      activeTabPath: state.activeTabPath,
      mainView: state.mainView,
      explorerWidth: state.explorerWidth,
      analysisWidth: state.analysisWidth,
      consoleHeight: state.consoleHeight,
    });

    if (lastSavedStringRef.current === serialized) {
      return;
    }
    lastSavedStringRef.current = serialized;

    pendingStateRef.current = {
      ...state,
      timestamp: Date.now(),
    };

    console.log("[STATE] save requested");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const stateToSave = pendingStateRef.current;
      if (!stateToSave) return;

      try {
        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.saveWorkspaceState) {
          await window.electronAPI.saveWorkspaceState(stateToSave);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        }
        console.log("[STATE] save complete");
      } catch (err) {
        console.error("[STATE-HOOK] Error saving workspace state:", err);
      }
    }, 1000);
  }, []);

  // 3. Debounced recovery snapshot engine (15 seconds debounce, only when dirty)
  const requestRecoverySnapshot = useCallback((snapshot: RecoverySnapshot) => {
    if (!snapshot || !snapshot.workspacePath) return;

    const hasDirty = (snapshot.openTabs || []).some((t) => t.isDirty);
    if (!hasDirty) {
      pendingRecoveryRef.current = snapshot;
      flushRecoverySnapshot();
      return;
    }

    const contentHash = (snapshot.openTabs || [])
      .map((t) => `${t.path}:${t.content}:${t.isDirty}`)
      .join("|");

    if (lastRecoveryHashRef.current === contentHash) {
      return;
    }
    lastRecoveryHashRef.current = contentHash;
    pendingRecoveryRef.current = snapshot;

    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }

    recoveryTimeoutRef.current = setTimeout(() => {
      flushRecoverySnapshot();
    }, 15000);
  }, [flushRecoverySnapshot]);

  return {
    loadedState,
    requestSave,
    requestRecoverySnapshot,
    flushRecoverySnapshot,
    hasLoaded,
  };
}
