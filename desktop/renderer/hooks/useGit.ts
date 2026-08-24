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

export interface GitBranchInfo {
  name: string;
  displayName: string;
  current: boolean;
  isRemote: boolean;
  tracking?: string | null;
  ahead?: number;
  behind?: number;
  commit?: string;
  label?: string;
}

export interface GitStashItem {
  id: string;
  index: number;
  hash?: string;
  date?: string;
  message: string;
  branch?: string;
}

export interface GitCommitFileChange {
  file: string;
  insertions: number;
  deletions: number;
  status?: string;
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  message: string;
  body?: string;
  author: string;
  email: string;
  timestamp: number;
  date: string;
  parents: string[];
  branchRefs: string[];
  tags: string[];
  isMerge: boolean;
  isHead?: boolean;
  lane?: number;
  parentLanes?: number[];
  filesChanged?: GitCommitFileChange[];
  totalFilesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface GitGraphEdge {
  from: string;
  to: string;
  fromLane: number;
  toLane: number;
  isMerge?: boolean;
}

export interface GitHistoryGraph {
  commits: GitCommitItem[];
  edges: GitGraphEdge[];
  refs: Record<string, { branches: string[]; tags: string[]; isHead: boolean }>;
  branches: GitBranchInfo[];
  totalCommits: number;
  currentBranch: string;
}

export interface GitStatusState {
  isRepo: boolean;
  currentBranch: string;
  isDetached: boolean;
  tracking: string | null;
  ahead: number;
  behind: number;
  isClean: boolean;
  hasLocalChanges: boolean;
  staged: GitFileItem[];
  unstaged: GitFileItem[];
  untracked: GitFileItem[];
  lastCommit: LastCommitInfo | null;
}

export function useGit(workspacePath: string = "") {
  const [gitState, setGitState] = useState<GitStatusState>({
    isRepo: false,
    currentBranch: "",
    isDetached: false,
    tracking: null,
    ahead: 0,
    behind: 0,
    isClean: true,
    hasLocalChanges: false,
    staged: [],
    unstaged: [],
    untracked: [],
    lastCommit: null,
  });

  const [branches, setBranches] = useState<string[]>([]);
  const [branchDetails, setBranchDetails] = useState<GitBranchInfo[]>([]);
  const [stashes, setStashes] = useState<GitStashItem[]>([]);
  
  // Milestone 28: History Graph State
  const [historyGraph, setHistoryGraph] = useState<GitHistoryGraph | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitItem | null>(null);
  const [selectedCommitDiff, setSelectedCommitDiff] = useState<any>(null);
  const [historyBranch, setHistoryBranch] = useState<string>("ALL");
  const [fileHistory, setFileHistory] = useState<GitCommitItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;

  const activeRequestIdRef = useRef<number>(0);

  const refreshStatus = useCallback(async (pathOverride?: string) => {
    const ws = pathOverride || workspaceRef.current;
    if (!ws || typeof window === "undefined" || !window.electronAPI || !window.electronAPI.git) {
      setBranches([]);
      setBranchDetails([]);
      setStashes([]);
      setHistoryGraph(null);
      return;
    }

    const requestId = ++activeRequestIdRef.current;

    try {
      const statusRes = await window.electronAPI.git.status(ws);
      // Guard against stale response if workspace changed while status was in flight
      if (requestId !== activeRequestIdRef.current || ws !== workspaceRef.current) {
        return;
      }

      if (statusRes) {
        setGitState({
          isRepo: !!statusRes.isRepo,
          currentBranch: statusRes.currentBranch || "",
          isDetached: Boolean(statusRes.isDetached),
          tracking: statusRes.tracking || null,
          ahead: typeof statusRes.ahead === "number" ? statusRes.ahead : 0,
          behind: typeof statusRes.behind === "number" ? statusRes.behind : 0,
          isClean: statusRes.isClean !== undefined ? Boolean(statusRes.isClean) : (statusRes.staged?.length === 0 && statusRes.unstaged?.length === 0 && statusRes.untracked?.length === 0),
          hasLocalChanges: statusRes.hasLocalChanges !== undefined ? Boolean(statusRes.hasLocalChanges) : ((statusRes.staged?.length || 0) + (statusRes.unstaged?.length || 0) + (statusRes.untracked?.length || 0) > 0),
          staged: statusRes.staged || [],
          unstaged: statusRes.unstaged || [],
          untracked: statusRes.untracked || [],
          lastCommit: statusRes.lastCommit || null,
        });

        if (statusRes.isRepo) {
          try {
            const branchRes: any = await (window.electronAPI.git as any).branches(ws);
            if (requestId !== activeRequestIdRef.current || ws !== workspaceRef.current) {
              return;
            }
            if (branchRes) {
              setBranches(Array.isArray(branchRes.all) ? branchRes.all : []);
              setBranchDetails(Array.isArray(branchRes.branches) ? branchRes.branches : []);
            } else {
              setBranches([]);
              setBranchDetails([]);
            }
          } catch (bErr) {
            if (requestId === activeRequestIdRef.current && ws === workspaceRef.current) {
              setBranches([]);
              setBranchDetails([]);
            }
          }

          try {
            if ((window.electronAPI.git as any)?.stashes) {
              const stashRes = await (window.electronAPI.git as any).stashes(ws);
              if (requestId !== activeRequestIdRef.current || ws !== workspaceRef.current) {
                return;
              }
              setStashes(Array.isArray(stashRes) ? stashRes : []);
            }
          } catch (sErr) {
            if (requestId === activeRequestIdRef.current && ws === workspaceRef.current) {
              setStashes([]);
            }
          }
        } else {
          // When isRepo is false, immediately clear branches, stashes, and history
          setBranches([]);
          setBranchDetails([]);
          setStashes([]);
          setHistoryGraph(null);
          setSelectedCommit(null);
          setSelectedCommitDiff(null);
          setFileHistory([]);
        }
      }
    } catch (err: any) {
      console.error("[USE-GIT] refreshStatus error:", err);
      if (requestId === activeRequestIdRef.current && ws === workspaceRef.current) {
        setBranches([]);
        setBranchDetails([]);
        setStashes([]);
        setHistoryGraph(null);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Immediately reset workspace-specific Git UI state on workspace change
    setBranches([]);
    setBranchDetails([]);
    setStashes([]);
    setHistoryGraph(null);
    setSelectedCommit(null);
    setSelectedCommitDiff(null);
    setFileHistory([]);
    setGitState({
      isRepo: false,
      currentBranch: "",
      isDetached: false,
      tracking: null,
      ahead: 0,
      behind: 0,
      isClean: true,
      hasLocalChanges: false,
      staged: [],
      unstaged: [],
      untracked: [],
      lastCommit: null,
    });

    // 2. Fetch fresh status for the new workspace if valid
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

  const fetchRemote = useCallback(async (remote = "origin") => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return false;
    setLoading(true);
    try {
      const res = await (window.electronAPI.git as any).fetch(ws, remote);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && res.success) {
        showToast(res.message || `Fetched from ${remote}`);
        await refreshStatus(ws);
        return true;
      } else {
        showToast(res?.message || "Fetch failed", true);
        return false;
      }
    } catch (err: any) {
      showToast(`Fetch failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const pullRemote = useCallback(async (remote = "origin", branch?: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return false;
    setLoading(true);
    try {
      const res = await (window.electronAPI.git as any).pull(ws, remote, branch);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && res.success) {
        showToast(res.message || `Pulled from ${remote}`);
        await refreshStatus(ws);
        return true;
      } else {
        showToast(res?.message || "Pull failed", true);
        return false;
      }
    } catch (err: any) {
      showToast(`Pull failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const pushChanges = useCallback(async (remote = "origin", branch?: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return false;
    setLoading(true);
    try {
      const res = await window.electronAPI.git.push(ws, remote, branch);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && res.success) {
        showToast(res.message || "Pushed changes to remote!");
        return true;
      } else {
        showToast(res?.message || "Push failed", true);
        return false;
      }
    } catch (err: any) {
      showToast(`Push failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncRemote = useCallback(async (remote = "origin", branch?: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git) return false;
    setLoading(true);
    try {
      const res = await (window.electronAPI.git as any).sync(ws, remote, branch);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && res.success) {
        showToast(res.message || "Synced with remote successfully!");
        await refreshStatus(ws);
        return true;
      } else {
        showToast(res?.message || "Sync failed", true);
        return false;
      }
    } catch (err: any) {
      showToast(`Sync failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const commitAndPushChanges = useCallback(async (message: string) => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git || !message.trim()) return false;
    setLoading(true);
    try {
      const res = await window.electronAPI.git.commitAndPush(ws, message.trim());
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && res.success) {
        showToast(res.message || "Committed and pushed successfully!");
        return true;
      }
      showToast(res?.message || "Commit and push failed", true);
      return false;
    } catch (err: any) {
      showToast(`Commit & Push failed: ${err.message || String(err)}`, true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const suggestCommitMessage = useCallback(async (): Promise<string | null> => {
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.git?.suggestCommitMessage) return null;
    try {
      const res = await window.electronAPI.git.suggestCommitMessage(ws);
      if (res && res.suggestedMessage) {
        return res.suggestedMessage;
      }
      return null;
    } catch (err: any) {
      console.error("[USE-GIT] suggestCommitMessage error:", err);
      return null;
    }
  }, []);

  const validateBranchName = useCallback(async (name: string) => {
    const gitApi = (window as any)?.electronAPI?.git;
    if (typeof window !== "undefined" && gitApi?.validateBranchName) {
      try {
        return await gitApi.validateBranchName(name);
      } catch (e: any) {
        return { valid: false, error: e.message || "Invalid branch name" };
      }
    }
    if (!name || !name.trim()) return { valid: false, error: "Branch name cannot be empty." };
    if (/\s/.test(name)) return { valid: false, error: "Branch name cannot contain spaces." };
    return { valid: true };
  }, []);

  const checkoutBranch = useCallback(async (branchName: string, force = false) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.checkout || !branchName.trim()) return false;
    setLoading(true);
    try {
      const updated = await gitApi.checkout(ws, branchName.trim(), { force });
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(`Switched to branch '${branchName.trim()}'`);
        await refreshStatus(ws);
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(`Checkout failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const createAndCheckoutBranch = useCallback(async (branchName: string, checkout = true) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.createBranch || !branchName.trim()) return false;
    setLoading(true);
    try {
      const updated = await gitApi.createBranch(ws, branchName.trim(), checkout);
      if (updated) {
        setGitState((prev) => ({ ...prev, ...updated }));
        showToast(checkout ? `Created and switched to '${branchName.trim()}'` : `Created branch '${branchName.trim()}'`);
        await refreshStatus(ws);
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(`Create branch failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const refreshStashes = useCallback(async () => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashes) return;
    try {
      const list = await gitApi.stashes(ws);
      if (Array.isArray(list)) {
        setStashes(list);
      }
    } catch (e) {}
  }, []);

  const stashSave = useCallback(async (options?: { message?: string; includeUntracked?: boolean } | string) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashSave) return false;
    setLoading(true);
    try {
      const res = await gitApi.stashSave(ws, options);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && Array.isArray(res.stashes)) {
        setStashes(res.stashes);
      }
      showToast(res?.message || "Changes stashed successfully.");
      await refreshStatus(ws);
      return true;
    } catch (err: any) {
      showToast(`Stash save failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stashApply = useCallback(async (stashId = "stash@{0}") => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashApply) return false;
    setLoading(true);
    try {
      const res = await gitApi.stashApply(ws, stashId);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      showToast(res?.message || `Applied ${stashId} successfully.`);
      await refreshStatus(ws);
      return true;
    } catch (err: any) {
      showToast(`Stash apply failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stashPop = useCallback(async (stashId = "stash@{0}") => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashPop) return false;
    setLoading(true);
    try {
      const res = await gitApi.stashPop(ws, stashId);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && Array.isArray(res.stashes)) {
        setStashes(res.stashes);
      }
      showToast(res?.message || `Popped ${stashId} successfully.`);
      await refreshStatus(ws);
      return true;
    } catch (err: any) {
      showToast(`Stash pop failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stashDrop = useCallback(async (stashId = "stash@{0}") => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashDrop) return false;
    setLoading(true);
    try {
      const res = await gitApi.stashDrop(ws, stashId);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      if (res && Array.isArray(res.stashes)) {
        setStashes(res.stashes);
      }
      showToast(res?.message || `Dropped ${stashId} successfully.`);
      await refreshStatus(ws);
      return true;
    } catch (err: any) {
      showToast(`Stash drop failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stashClear = useCallback(async () => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.stashClear) return false;
    setLoading(true);
    try {
      const res = await gitApi.stashClear(ws);
      if (res && res.status) {
        setGitState((prev) => ({ ...prev, ...res.status }));
      }
      setStashes([]);
      showToast("Cleared all stashes.");
      await refreshStatus(ws);
      return true;
    } catch (err: any) {
      showToast(`Stash clear failed: ${err.message || String(err)}`, true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

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

  const fetchHistory = useCallback(async (options: { branch?: string; maxCount?: number; skip?: number; file?: string } = {}) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.history) return null;

    setHistoryLoading(true);
    try {
      const branchToQuery = options.branch || historyBranch;
      const res = await gitApi.history(ws, {
        ...options,
        branch: branchToQuery === "ALL" ? undefined : branchToQuery,
      });

      if (ws !== workspaceRef.current) return null;

      if (res && res.success) {
        setHistoryGraph({
          commits: res.commits || [],
          edges: res.edges || [],
          refs: res.refs || {},
          branches: res.branches || [],
          totalCommits: res.totalCommits || 0,
          currentBranch: res.currentBranch || "",
        });
        return res;
      }
      return null;
    } catch (err: any) {
      console.error("[USE-GIT] fetchHistory error:", err);
      return null;
    } finally {
      if (ws === workspaceRef.current) {
        setHistoryLoading(false);
      }
    }
  }, [historyBranch]);

  const fetchCommitDetails = useCallback(async (hash: string) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.commitDetails || !hash) return null;

    try {
      const res = await gitApi.commitDetails(ws, hash);
      if (res && res.success) {
        setSelectedCommit(res.commit);
        return res.commit;
      }
      return null;
    } catch (err: any) {
      console.error("[USE-GIT] fetchCommitDetails error:", err);
      return null;
    }
  }, []);

  const fetchCommitDiff = useCallback(async (hash: string, file?: string, parentIndex = 0) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.commitDiff || !hash) return null;

    try {
      const res = await gitApi.commitDiff(ws, hash, file, parentIndex);
      if (res && res.success) {
        setSelectedCommitDiff(res);
        return res;
      }
      return null;
    } catch (err: any) {
      console.error("[USE-GIT] fetchCommitDiff error:", err);
      return null;
    }
  }, []);

  const fetchFileHistory = useCallback(async (filePath: string, options: any = {}) => {
    const ws = workspaceRef.current;
    const gitApi = (window as any)?.electronAPI?.git;
    if (!ws || !gitApi?.fileHistory || !filePath) return [];

    try {
      const res = await gitApi.fileHistory(ws, filePath, options);
      if (res && res.success) {
        setFileHistory(res.commits || []);
        return res.commits || [];
      }
      return [];
    } catch (err: any) {
      console.error("[USE-GIT] fetchFileHistory error:", err);
      return [];
    }
  }, []);

  return {
    ...gitState,
    branches,
    branchDetails,
    stashes,
    loading,
    statusMessage,
    errorMessage,
    refreshStatus,
    refreshStashes,
    stageFile,
    unstageFile,
    stageAllFiles,
    unstageAllFiles,
    commitChanges,
    fetchRemote,
    pullRemote,
    pushChanges,
    syncRemote,
    commitAndPushChanges,
    suggestCommitMessage,
    validateBranchName,
    checkoutBranch,
    createAndCheckoutBranch,
    stashSave,
    stashApply,
    stashPop,
    stashDrop,
    stashClear,
    discardFile,
    getFileDiff,
    // Milestone 28: Git Visual History Graph & Inspection
    historyGraph,
    selectedCommit,
    selectedCommitDiff,
    historyBranch,
    setHistoryBranch,
    fileHistory,
    historyLoading,
    fetchHistory,
    fetchCommitDetails,
    fetchCommitDiff,
    fetchFileHistory,
    setSelectedCommit,
    setSelectedCommitDiff,
  };
}
