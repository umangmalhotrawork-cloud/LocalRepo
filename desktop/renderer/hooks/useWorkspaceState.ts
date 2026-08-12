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
  mainView: "editor" | "dashboard" | "graph";
  explorerWidth: number;
  analysisWidth: number;
  consoleHeight: number;
  editorStates?: Record<string, EditorViewState>;
  timestamp?: number;
}

const LOCAL_STORAGE_KEY = "echo_workspace_state";

export function useWorkspaceState() {
  const [loadedState, setLoadedState] = useState<WorkspacePersistedState | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<WorkspacePersistedState | null>(null);

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
    };
  }, []);

  // 2. Debounced save function
  const requestSave = useCallback((state: WorkspacePersistedState) => {
    if (!state || !state.folderPath) return;

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

  return {
    loadedState,
    requestSave,
    hasLoaded,
  };
}
