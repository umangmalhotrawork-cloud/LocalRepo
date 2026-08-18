"use client";

import { useState, useEffect } from "react";
import { 
  Command, Search, FolderOpen, Play, Sparkles, RotateCcw, 
  Sidebar, Terminal, FileText, X, Zap, ShieldAlert, Camera, History,
  Network, Copy, Compass
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: any;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
  onRunTomography: () => void;
  onApplySafeRemove: () => void;
  onRestoreBackup: () => void;
  onToggleExplorer: () => void;
  onToggleConsole: () => void;
  onRestoreRecoverySession?: () => void;
  onDiscardRecoverySession?: () => void;
  onOpenTestExplorer?: () => void;
  onRunAllTests?: () => void;
  onRunCurrentFileTests?: () => void;
  onOpenProfiler?: () => void;
  onProfileCurrentFile?: () => void;
  onProfileCurrentTest?: () => void;
  onProfileTerminal?: () => void;
  onExportProfiler?: () => void;
  onClearProfilerDecorations?: () => void;
  onOpenSecurityAudit?: () => void;
  onRunSecurityScan?: () => void;
  onExportSecurityReport?: () => void;
  onCreateSnapshot?: () => void;
  onOpenSnapshots?: () => void;
  onCompareLatestSnapshot?: () => void;
  onRestoreLastSnapshot?: () => void;
  onOpenDashboard?: () => void;
  onOpenGraph?: () => void;
  onOpenClones?: () => void;
  onOpenFingerprint?: () => void;
  onOpenFirewall?: () => void;
  onOpenIntentRadar?: () => void;
  openTabs: { path: string; name: string }[];
  onSelectTab: (path: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onOpenFolder,
  onRunTomography,
  onApplySafeRemove,
  onRestoreBackup,
  onToggleExplorer,
  onToggleConsole,
  onRestoreRecoverySession,
  onDiscardRecoverySession,
  onOpenTestExplorer,
  onRunAllTests,
  onRunCurrentFileTests,
  onOpenProfiler,
  onProfileCurrentFile,
  onProfileCurrentTest,
  onProfileTerminal,
  onExportProfiler,
  onClearProfilerDecorations,
  onOpenSecurityAudit,
  onRunSecurityScan,
  onExportSecurityReport,
  onCreateSnapshot,
  onOpenSnapshots,
  onCompareLatestSnapshot,
  onRestoreLastSnapshot,
  onOpenDashboard,
  onOpenGraph,
  onOpenClones,
  onOpenFingerprint,
  onOpenFirewall,
  onOpenIntentRadar,
  openTabs,
  onSelectTab,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  if (!isOpen) return null;

  const commands: CommandItem[] = [
    {
      id: "open-folder",
      title: "Open Folder...",
      category: "File Operations",
      icon: FolderOpen,
      action: () => { onOpenFolder(); onClose(); },
    },
    {
      id: "create-workspace-snapshot",
      title: "Create Workspace Snapshot",
      category: "Snapshots",
      icon: Camera,
      shortcut: "⌘⇧B",
      action: () => { if (onCreateSnapshot) onCreateSnapshot(); onClose(); },
    },
    {
      id: "open-snapshots",
      title: "Open Snapshots",
      category: "Snapshots",
      icon: History,
      action: () => { if (onOpenSnapshots) onOpenSnapshots(); onClose(); },
    },
    {
      id: "compare-latest-snapshot",
      title: "Compare With Latest Snapshot",
      category: "Snapshots",
      icon: Sparkles,
      action: () => { if (onCompareLatestSnapshot) onCompareLatestSnapshot(); onClose(); },
    },
    {
      id: "restore-last-snapshot",
      title: "Restore Last Snapshot",
      category: "Snapshots",
      icon: RotateCcw,
      action: () => { if (onRestoreLastSnapshot) onRestoreLastSnapshot(); onClose(); },
    },
    {
      id: "open-security-audit",
      title: "Open Security Audit",
      category: "Security",
      icon: ShieldAlert,
      shortcut: "⌘⇧S",
      action: () => { if (onOpenSecurityAudit) onOpenSecurityAudit(); onClose(); },
    },
    {
      id: "run-security-scan",
      title: "Run Security Scan",
      category: "Security",
      icon: Play,
      action: () => { if (onRunSecurityScan) onRunSecurityScan(); onClose(); },
    },
    {
      id: "export-security-report",
      title: "Export Security Report",
      category: "Security",
      icon: Sparkles,
      action: () => { if (onExportSecurityReport) onExportSecurityReport(); onClose(); },
    },
    {
      id: "open-profiler",
      title: "Open Profiler",
      category: "Performance Profiler",
      icon: Zap,
      shortcut: "⌘⇧P",
      action: () => { if (onOpenProfiler) onOpenProfiler(); onClose(); },
    },
    {
      id: "profile-current-file",
      title: "Profile Current File",
      category: "Performance Profiler",
      icon: Play,
      shortcut: "F7",
      action: () => { if (onProfileCurrentFile) onProfileCurrentFile(); onClose(); },
    },
    {
      id: "profile-current-test",
      title: "Profile Current Test",
      category: "Performance Profiler",
      icon: Play,
      shortcut: "⇧F7",
      action: () => { if (onProfileCurrentTest) onProfileCurrentTest(); onClose(); },
    },
    {
      id: "profile-terminal-command",
      title: "Profile Last Terminal Command",
      category: "Performance Profiler",
      icon: Terminal,
      action: () => { if (onProfileTerminal) onProfileTerminal(); onClose(); },
    },
    {
      id: "export-profiler-report",
      title: "Export Profiler Report",
      category: "Performance Profiler",
      icon: Sparkles,
      action: () => { if (onExportProfiler) onExportProfiler(); onClose(); },
    },
    {
      id: "clear-profiler-decorations",
      title: "Clear Profiler Decorations",
      category: "Performance Profiler",
      icon: X,
      action: () => { if (onClearProfilerDecorations) onClearProfilerDecorations(); onClose(); },
    },
    {
      id: "open-test-explorer",
      title: "Open Test Explorer & Coverage",
      category: "Testing",
      icon: Sparkles,
      shortcut: "⌘⇧T",
      action: () => { if (onOpenTestExplorer) onOpenTestExplorer(); onClose(); },
    },
    {
      id: "run-all-tests",
      title: "Run All Tests in Workspace",
      category: "Testing",
      icon: Play,
      action: () => { if (onRunAllTests) onRunAllTests(); onClose(); },
    },
    {
      id: "run-current-file-tests",
      title: "Run Tests in Current File",
      category: "Testing",
      icon: Play,
      shortcut: "⇧F6",
      action: () => { if (onRunCurrentFileTests) onRunCurrentFileTests(); onClose(); },
    },
    {
      id: "restore-previous-session",
      title: "Restore Previous Session",
      category: "Crash Recovery",
      icon: RotateCcw,
      action: () => { if (onRestoreRecoverySession) onRestoreRecoverySession(); onClose(); },
    },
    {
      id: "discard-recovery-snapshot",
      title: "Discard Recovery Snapshot",
      category: "Crash Recovery",
      icon: X,
      action: () => { if (onDiscardRecoverySession) onDiscardRecoverySession(); onClose(); },
    },
    {
      id: "open-code-analysis",
      title: "Analyze Current File & Dependencies",
      category: "Code Analysis",
      icon: Sparkles,
      action: () => { onRunTomography(); onClose(); },
    },
    {
      id: "open-dependency-graph",
      title: "Inspect Workspace Dependency Graph",
      category: "Code Analysis",
      icon: Network,
      action: () => { if (onOpenGraph) onOpenGraph(); onClose(); },
    },
    {
      id: "open-code-clones",
      title: "Detect Structural Code Clones & Redundancy",
      category: "Code Analysis",
      icon: Copy,
      action: () => { if (onOpenClones) onOpenClones(); onClose(); },
    },
    {
      id: "open-behavior-fingerprint",
      title: "Inspect Behavioral Execution Fingerprint",
      category: "Code Analysis",
      icon: Zap,
      action: () => { if (onOpenFingerprint) onOpenFingerprint(); onClose(); },
    },
    {
      id: "open-patch-firewall",
      title: "Inspect AI Safety Firewall & Risk Rules",
      category: "Code Analysis",
      icon: ShieldAlert,
      action: () => { if (onOpenFirewall) onOpenFirewall(); onClose(); },
    },
    {
      id: "open-intent-radar",
      title: "Analyze Semantic Intent Drift Radar",
      category: "Code Analysis",
      icon: Compass,
      action: () => { if (onOpenIntentRadar) onOpenIntentRadar(); onClose(); },
    },
    {
      id: "run-tomography",
      title: "Run Analysis Scan",
      category: "Code Analysis",
      icon: Play,
      shortcut: "F5",
      action: () => { onRunTomography(); onClose(); },
    },
    {
      id: "safe-remove",
      title: "Apply Safe Remove Surgery",
      category: "Code Analysis",
      icon: Sparkles,
      action: () => { onApplySafeRemove(); onClose(); },
    },
    {
      id: "restore-backup",
      title: "Restore Backup Snapshot",
      category: "File Operations",
      icon: RotateCcw,
      action: () => { onRestoreBackup(); onClose(); },
    },
    {
      id: "toggle-explorer",
      title: "Toggle Sidebar Explorer",
      category: "View Options",
      icon: Sidebar,
      action: () => { onToggleExplorer(); onClose(); },
    },
    {
      id: "toggle-console",
      title: "Toggle Console Log Panel",
      category: "View Options",
      icon: Terminal,
      action: () => { onToggleConsole(); onClose(); },
    },
    ...openTabs.map((t) => ({
      id: `tab-${t.path}`,
      title: `Switch to ${t.name}`,
      category: "Open Files",
      icon: FileText,
      action: () => { onSelectTab(t.path); onClose(); },
    })),
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-xl bg-[#0a0a0a] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Search Header */}
        <div className="p-4 border-b border-[#1f1f1f] flex items-center gap-3 bg-[#050505]">
          <Search className="w-4 h-4 text-cyan-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or file name..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-cyan-950/40 hover:text-cyan-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
                    <div>
                      <div className="text-zinc-200 font-semibold group-hover:text-cyan-200">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-zinc-500">{item.category}</div>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#262626] text-zinc-400 text-[10px]">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-zinc-500 text-xs">
              No matching commands found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#050505] border-t border-[#1f1f1f] text-[10px] text-zinc-500 flex justify-between font-mono">
          <span>Navigate with ↑ ↓ · Press Enter to execute</span>
          <span>ESC to close</span>
        </div>

      </div>
    </div>
  );
}
