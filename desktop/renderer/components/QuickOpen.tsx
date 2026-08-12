"use client";

import { useState, useEffect } from "react";
import { Search, FileText, X } from "lucide-react";

interface FileItem {
  name: string;
  path: string;
}

interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  onSelectFile: (path: string, name: string) => void;
}

export default function QuickOpen({
  isOpen,
  onClose,
  files,
  onSelectFile,
}: QuickOpenProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = files.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.path.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Search Input */}
        <div className="p-4 border-b border-[#1f1f1f] flex items-center gap-3 bg-[#050505]">
          <Search className="w-4 h-4 text-purple-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type file name to open (⌘P)..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {filtered.length > 0 ? (
            filtered.map((file) => (
              <button
                key={file.path}
                onClick={() => {
                  onSelectFile(file.path, file.name);
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-purple-950/40 hover:text-purple-300 transition-all text-left group"
              >
                <div className="flex items-center gap-3 truncate">
                  <FileText className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                  <div className="truncate">
                    <div className="text-zinc-200 font-bold group-hover:text-purple-200 truncate">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">{file.path}</div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-6 text-center text-zinc-500 text-xs">
              No matching files found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#050505] border-t border-[#1f1f1f] text-[10px] text-zinc-500 flex justify-between font-mono">
          <span>Quick File Search · Press Enter to open</span>
          <span>ESC to cancel</span>
        </div>

      </div>
    </div>
  );
}
