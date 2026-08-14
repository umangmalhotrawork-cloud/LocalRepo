"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface GitFileItem {
  path: string;
  status: string; // 'M' | 'A' | 'D' | 'R' | '??'
  fullStatus?: any;
}

export interface LastCommitInfo {
  hash: string;
  fullHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatusState {
  isRepo: boolean;
  currentBranch: string;
  staged: GitFileItem[];
  unstaged: GitFileItem[];
  untracked: GitFileItem[];
  lastCommit: LastCommitInfo | null;
}

export function useGit(workspacePath: string = "") {
  const [gitState, setGitState] = useState<GitStatusState>({
    isRepo: false,
    currentBranch: "",
    staged: [],
    unstaged: [],
    untracked: [],
    lastCommit: null,
  });

  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;

  const refreshStatus = useCallback(async (pathOverride?: string) => {
    const ws = pathOverride || workspaceRef.current;
    if (!ws || typeof window === "undefined" || !window.electronAPI || !window.electronAPI.git) {
      return;
    }

    try {
      const statusRes = await window.electronAPI.git.status(ws);
      if (statusRes) {
        setGitState({
          isRepo: !!statusRes.isRepo,
          currentBranch: statusRes.currentBranch || "",
          staged: statusRes.staged || [],
          unstaged: statusRes.unstaged || [],
          untracked: statusRes.untracked || [],
          lastCommit: statusRes.lastCommit || null,
        });

        if (statusRes.isRepo) {
          try {
            const branchRes = await window.electronAPI.git.branches(ws);
            if (branchRes && Array.isArray(branchRes.all)) {
              setBranches(branchRes.all);
            }
          } catch (bErr) {}
        }
      }
    } catch (err: any) {
      console.error("[USE-GIT] refreshStatus error:", err);
    }
  }, []);

  useEffect(() => {
    if (workspacePath) {
      refreshStatus(workspacePath);
    }
  }, [workspacePath, refreshStatus]);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    } else {
      setStatusMessage(msg);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const stageFile = useCallback(async (filePath: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.stage(ws, filePath);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(`Staged ${filePath}`);
      }
    } catch (err: any) {
      showToast(`Failed to stage ${filePath}: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const unstageFile = useCallback(async (filePath: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.unstage(ws, filePath);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(`Unstaged ${filePath}`);
      }
    } catch (err: any) {
      showToast(`Failed to unstage ${filePath}: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const stageAllFiles = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.stageAll(ws);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast("Staged all changes");
      }
    } catch (err: any) {
      showToast(`Failed to stage all: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const unstageAllFiles = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.unstageAll(ws);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast("Unstaged all changes");
      }
    } catch (err: any) {
      showToast(`Failed to unstage all: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const commitChanges = useCallback(async (message: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git || !message.trim()) return false;
    setLoading(true);
    try {
      const res = await window.electronAPI.git.commit(ws, message.trim());
      if (res && res.success) {
        if (res.status) {
          setGitState((prev) => ({ ...prev, ...res.status }));
        }
        showToast("Commit created successfully!");
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(`Commit failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkoutBranch = useCallback(async (branchName: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.checkout(ws, branchName);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(`Switched to branch '${branchName}'`);
      }
    } catch (err: any) {
      showToast(`Checkout failed: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAndCheckoutBranch = useCallback(async (branchName: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git || !branchName.trim()) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.createBranch(ws, branchName.trim());
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        setBranches((prev) => [...new Set([...prev, branchName.trim()])]);
        showToast(`Created and checked out '${branchName.trim()}'`);
      }
    } catch (err: any) {
      showToast(`Create branch failed: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const discardFile = useCallback(async (filePath: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return;
    setLoading(true);
    try {
      const updated = await window.electronAPI.git.discard(ws, filePath);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(`Discarded changes in ${filePath}`);
      }
    } catch (err: any) {
      showToast(`Discard failed: ${err.message || String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, []);

  const getFileDiff = useCallback(async (filePath: string, staged = false) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return null;
    try {
      return await window.electronAPI.git.diff(ws, filePath, staged);
    } catch (err: any) {
      console.error("[USE-GIT] getFileDiff error:", err);
      return null;
    }
  }, []);

  return {
    ...gitState,
    branches,
    loading,
    statusMessage,
    errorMessage,
    refreshStatus,
    stageFile,
    unstageFile,
    stageAllFiles,
    unstageAllFiles,
    commitChanges,
    checkoutBranch,
    createAndCheckoutBranch,
    discardFile,
    getFileDiff,
  };
}
