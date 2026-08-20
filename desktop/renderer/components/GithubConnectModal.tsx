"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Github, CheckCircle2, AlertCircle, Loader2, X, GitFork, LogOut, Check,
  Search, Lock, Globe, ArrowLeft, ShieldCheck
} from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

export interface GithubUser {
  username: string;
  name?: string;
  avatarUrl?: string;
}

export interface GithubRepository {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch?: string;
}

interface GithubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  workspacePath?: string;
}

export default function GithubConnectModal({
  isOpen,
  onClose,
  triggerRef,
  workspacePath = "",
}: GithubConnectModalProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [user, setUser] = useState<GithubUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repoActionNotice, setRepoActionNotice] = useState<string | null>(null);

  // Repository Picker state
  const [viewMode, setViewMode] = useState<"account" | "picker">("account");
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [associatedRepo, setAssociatedRepo] = useState<GithubRepository | null>(null);
  const [associatedRemoteStatus, setAssociatedRemoteStatus] = useState<string | null>(null);

  const modalRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
    triggerRef,
  });

  // Fetch initial connection status and workspace repo association on open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setRepoActionNotice(null);
    setViewMode("account");
    setSearchQuery("");
    setSelectedRepoId(null);

    let isMounted = true;

    async function checkStatusAndRepo() {
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.github) {
          const api = (window as any).electronAPI.github;
          const configRes = await api.configStatus?.();
          if (isMounted && configRes && !configRes.isConfigured) {
            setErrorMessage("GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to the project-root .env file, then restart NEXUS.");
          } else if (isMounted && configRes && !configRes.hasSecureStorage) {
            setErrorMessage("Secure credential storage is unavailable. GitHub cannot be connected on this system.");
          }
          const statusRes = await api.status?.();
          if (isMounted && statusRes) {
            setIsConnected(!!statusRes.isConnected);
            setUser(statusRes.user || null);
          }

          if (workspacePath && api.getSelectedRepo) {
            const selectedRes = await api.getSelectedRepo(workspacePath);
            if (isMounted && selectedRes && selectedRes.repo) {
              setAssociatedRepo(selectedRes.repo);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("[GITHUB-MODAL] Error checking status:", err.message);
        }
      }
    }

    checkStatusAndRepo();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspacePath]);

  // Load repositories when switching to picker view
  const handleOpenRepoPicker = async () => {
    setViewMode("picker");
    setLoadingRepos(true);
    setErrorMessage(null);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.github?.listRepos) {
        const res = await (window as any).electronAPI.github.listRepos();
        if (res && res.success && Array.isArray(res.repositories)) {
          setRepositories(res.repositories);
          if (associatedRepo) {
            setSelectedRepoId(associatedRepo.id);
          } else if (res.repositories.length > 0) {
            setSelectedRepoId(res.repositories[0].id);
          }
        } else {
          setErrorMessage(res?.error || "Failed to load GitHub repositories.");
        }
      } else {
        setErrorMessage("GitHub repository selection is available only in the NEXUS desktop app.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch repositories.");
    } finally {
      setLoadingRepos(false);
    }
  };

  const filteredRepositories = useMemo(() => {
    if (!searchQuery.trim()) return repositories;
    const q = searchQuery.toLowerCase().trim();
    return repositories.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q)
    );
  }, [repositories, searchQuery]);

  const selectedRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || null;
  }, [repositories, selectedRepoId]);

  const handleConnectRepository = async () => {
    if (!selectedRepo) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.github?.associateRepo) {
        const res = await (window as any).electronAPI.github.associateRepo({
          workspacePath,
          repo: selectedRepo,
        });

        if (res && res.success) {
          setAssociatedRepo(res.repo);
          setAssociatedRemoteStatus(res.remoteStatus || "Repository associated");
          setRepoActionNotice(`Connected "${res.repo.fullName}" to workspace. (${res.remoteStatus || "Remote configured"})`);
          setViewMode("account");
        } else {
          setErrorMessage(res?.error || "Failed to associate repository with workspace.");
        }
      } else {
        setErrorMessage("GitHub repository selection is available only in the NEXUS desktop app.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect repository.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setErrorMessage(null);
    setRepoActionNotice(null);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.github?.connect) {
        const res = await (window as any).electronAPI.github.connect();
        if (res && res.success && res.isConnected && res.user) {
          setIsConnected(true);
          setUser(res.user);
        } else {
          setErrorMessage(res?.error || "GitHub authentication failed. Please try again.");
        }
      } else {
        setErrorMessage("GitHub connection is available only in the NEXUS desktop app.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate GitHub authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setErrorMessage(null);
    setRepoActionNotice(null);
    setAssociatedRepo(null);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.github?.disconnect) {
        await (window as any).electronAPI.github.disconnect();
      }
      setIsConnected(false);
      setUser(null);
      setViewMode("account");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to disconnect GitHub account.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="absolute top-11 right-3 w-96 border rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 font-mono text-xs animate-fade-in select-none"
      style={{
        backgroundColor: "var(--theme-surface-raised, #0a0a0f)",
        borderColor: "var(--theme-border-card, #1f1f2e)",
        color: "var(--theme-text, #f4f4f5)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b pb-2.5"
        style={{ borderColor: "var(--theme-border-subtle, #1c1c28)" }}
      >
        <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "var(--theme-accent, #22d3ee)" }}>
          {viewMode === "picker" ? (
            <button
              onClick={() => setViewMode("account")}
              className="p-1 rounded hover:bg-[#161622] text-zinc-400 hover:text-white transition-colors cursor-pointer mr-0.5"
              title="Back to Account"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Github className="w-3.5 h-3.5" />
            </div>
          )}
          <span>{viewMode === "picker" ? "Select Repository" : isConnected ? "GitHub Connected" : "Connect GitHub"}</span>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-[9.5px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="text-[9.5px] px-2 py-0.5 rounded-full font-bold bg-amber-950/60 border border-amber-500/40 text-amber-300">
              Disconnected
            </span>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-[#161622] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Content - Switch between Picker and Account view */}
      {viewMode === "picker" ? (
        /* Repository Picker View */
        <div className="space-y-3">
          {/* Search Filter Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter repositories..."
              autoFocus
              className="w-full bg-[#12121c] border border-[#252536] focus:border-cyan-500/70 rounded-xl pl-8 pr-3 py-1.5 text-zinc-100 placeholder-zinc-500 outline-none text-xs font-mono transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
          </div>

          {/* Repositories Scrollable List */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
            {loadingRepos ? (
              <div className="py-8 flex items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading repositories...</span>
              </div>
            ) : filteredRepositories.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 text-[11px]">
                No matching repositories found.
              </div>
            ) : (
              filteredRepositories.map((repo) => {
                const isSelected = selectedRepoId === repo.id;
                const isCurrentAssociated = associatedRepo?.fullName === repo.fullName;

                return (
                  <div
                    key={repo.id}
                    onClick={() => setSelectedRepoId(repo.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/60 text-white"
                        : "bg-[#101018] hover:bg-[#161622] border-[#1f1f2e] text-zinc-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold truncate text-xs flex items-center gap-1.5">
                        <GitFork className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{repo.name}</span>
                        {isCurrentAssociated && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                        @{repo.owner}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {repo.private ? (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Private
                        </span>
                      ) : (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" />
                          Public
                        </span>
                      )}

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-500 text-black"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {errorMessage && (
            <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Picker Action Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1c1c2a]">
            <button
              type="button"
              onClick={() => setViewMode("account")}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1c1c2a] border border-[#252536] text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleConnectRepository}
              disabled={loading || !selectedRepo}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Connect Repository</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : isConnected && user ? (
        /* Connected Account View */
        <div className="space-y-3.5">
          <div className="p-3 rounded-xl bg-[#101018] border border-[#1f1f2e] flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-10 h-10 rounded-full border border-cyan-500/40 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-sm">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-zinc-100 truncate text-xs">{user.name || user.username}</div>
              <div className="text-[11px] text-cyan-400 font-mono font-medium">@{user.username}</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>

          {/* Workspace Associated Repository Card */}
          {associatedRepo && (
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-1">
              <div className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                <span>Associated Workspace Repo</span>
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="font-bold text-zinc-100 text-xs flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="truncate">{associatedRepo.fullName}</span>
              </div>
              {associatedRemoteStatus && (
                <div className="text-[10px] text-zinc-400">
                  {associatedRemoteStatus}
                </div>
              )}
            </div>
          )}

          {repoActionNotice && !associatedRepo && (
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-[10.5px] flex items-start gap-2 animate-fade-in">
              <GitFork className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>{repoActionNotice}</span>
            </div>
          )}

          {/* Connected Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleOpenRepoPicker}
              disabled={loading}
              className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>{associatedRepo ? "Change Repository" : "Select Repository"}</span>
            </button>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full py-1.5 px-3 rounded-xl bg-[#141420] hover:bg-rose-950/40 border border-[#252536] hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Disconnect GitHub</span>
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State */
        <div className="space-y-3.5">
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Connect your GitHub account to manage repositories and push your NEXUS workspace changes.
          </p>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Controls */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c1c2a]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1c1c2a] border border-[#252536] text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Github className="w-3.5 h-3.5" />
                  <span>Connect with GitHub</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
