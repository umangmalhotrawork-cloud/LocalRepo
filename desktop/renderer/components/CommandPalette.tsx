"use client";

import { useState, useEffect } from "react";
import { 
  Command, Search, FolderOpen, Play, Sparkles, RotateCcw, 
  Sidebar, Terminal, FileText, X, Zap 
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
      id: "run-tomography",
      title: "Run Tomography Scan",
      category: "Analysis Engine",
      icon: Play,
      shortcut: "F5",
      action: () => { onRunTomography(); onClose(); },
    },
    {
      id: "safe-remove",
      title: "Apply Safe Remove Surgery",
      category: "Analysis Engine",
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
