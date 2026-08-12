"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, FileText, Code2, Cpu, X, ArrowRight, CornerDownLeft, 
  Terminal, Sparkles, Hash, Layers, Activity 
} from "lucide-react";

export type SearchMode = "files" | "content" | "symbols";

export interface SearchResultItem {
  file: string;
  absolute_path: string;
  filename: string;
  line: number;
  column: number;
  preview: string;
  match_type: "file" | "content" | "function" | "class";
  symbol?: string;
}

export interface WorkspaceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  initialMode?: SearchMode;
  initialQuery?: string;
  onModeChange?: (mode: SearchMode) => void;
  onQueryChange?: (query: string) => void;
  onSelectResult: (result: SearchResultItem) => void;
}

export default function WorkspaceSearchModal({
  isOpen,
  onClose,
  workspacePath,
  initialMode = "files",
  initialQuery = "",
  onModeChange,
  onQueryChange,
  onSelectResult,
}: WorkspaceSearchModalProps) {
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRequestIdRef = useRef(0);

  // Sync mode and query when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setQuery(initialQuery);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialMode, initialQuery]);

  const updateMode = (newMode: SearchMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
  };

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
    onQueryChange?.(newQuery);
  };

  // Debounced search effect
  useEffect(() => {
    if (!isOpen) return;

    const currentReqId = ++searchRequestIdRef.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.searchWorkspace) {
        try {
          const res = await window.electronAPI.searchWorkspace({
            workspace: workspacePath,
            query,
            mode,
            limit: 200,
          });

          if (currentReqId === searchRequestIdRef.current) {
            setResults(res.results || []);
            setSelectedIndex(0);
            setLoading(false);
          }
        } catch (err) {
          if (currentReqId === searchRequestIdRef.current) {
            console.error("[WORKSPACE-SEARCH] Search error:", err);
            setResults([]);
            setLoading(false);
          }
        }
      } else {
        // Fallback for browser mock
        const mockResults: SearchResultItem[] = [
          {
            file: "src/cart_calculator.py",
            absolute_path: `${workspacePath}/src/cart_calculator.py`,
            filename: "cart_calculator.py",
            line: 1,
            column: 1,
            preview: mode === "symbols" ? "def calculate_cart_total(...)" : (mode === "content" ? "subtotal = subtotal * 1" : "src/cart_calculator.py"),
            match_type: mode === "symbols" ? "function" : (mode === "content" ? "content" : "file"),
            symbol: "calculate_cart_total",
          },
          {
            file: "src/checkout_engine.py",
            absolute_path: `${workspacePath}/src/checkout_engine.py`,
            filename: "checkout_engine.py",
            line: 1,
            column: 1,
            preview: mode === "symbols" ? "def process_checkout(...)" : (mode === "content" ? "total = calculate_cart_total(items)" : "src/checkout_engine.py"),
            match_type: mode === "symbols" ? "function" : (mode === "content" ? "content" : "file"),
            symbol: "process_checkout",
          },
          {
            file: "src/invoice_processor.py",
            absolute_path: `${workspacePath}/src/invoice_processor.py`,
            filename: "invoice_processor.py",
            line: 1,
            column: 1,
            preview: mode === "symbols" ? "def generate_invoice_pdf(...)" : (mode === "content" ? "invoice_id = f'INV-{order_id}'" : "src/invoice_processor.py"),
            match_type: mode === "symbols" ? "function" : (mode === "content" ? "content" : "file"),
            symbol: "generate_invoice_pdf",
          },
        ];

        const filtered = mockResults.filter((r) => {
          if (!query.trim()) return true;
          return r.filename.toLowerCase().includes(query.toLowerCase()) ||
                 r.preview.toLowerCase().includes(query.toLowerCase());
        });

        if (currentReqId === searchRequestIdRef.current) {
          setResults(filtered);
          setSelectedIndex(0);
          setLoading(false);
        }
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, query, mode, workspacePath]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
        scrollSelectedIntoView((selectedIndex + 1) % results.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        scrollSelectedIntoView((selectedIndex - 1 + results.length) % results.length);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        onSelectResult(results[selectedIndex]);
        onClose();
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const modes: SearchMode[] = ["files", "content", "symbols"];
      const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
      setMode(nextMode);
      return;
    }
  };

  const scrollSelectedIntoView = (idx: number) => {
    if (!listRef.current) return;
    const item = listRef.current.children[idx] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/75 backdrop-blur-sm animate-fade-in font-mono"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-[#262626] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 1. Mode Tabs & Search Bar */}
        <div className="p-3 bg-[#0d0d0d] border-b border-[#1f1f1f] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 p-0.5 bg-[#050505] rounded-xl border border-[#1f1f1f]">
              <button
                onClick={() => updateMode("files")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  mode === "files"
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Files</span>
                <span className="text-[10px] text-zinc-500 font-normal">⌘P</span>
              </button>

              <button
                onClick={() => updateMode("content")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  mode === "content"
                    ? "bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Content</span>
                <span className="text-[10px] text-zinc-500 font-normal">⌘⇧F</span>
              </button>

              <button
                onClick={() => updateMode("symbols")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  mode === "symbols"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Symbols</span>
                <span className="text-[10px] text-zinc-500 font-normal">⌘T</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">
                {loading ? "Searching..." : `${results.length} results`}
              </span>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder={
                mode === "files"
                  ? "Search files by name in workspace..."
                  : mode === "content"
                  ? "Search text across all files..."
                  : "Search functions and classes (AST)..."
              }
              className="w-full bg-[#141414] border border-[#262626] focus:border-cyan-500/60 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            />
            {loading && (
              <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400 absolute right-3 pointer-events-none" />
            )}
          </div>
        </div>

        {/* 2. Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#18181b]">
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-cyan-400">
                  <Activity className="w-5 h-5 animate-spin" />
                  <span>Searching workspace tomography...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <span>No matches found in {mode} mode.</span>
                  <span className="text-[11px] text-zinc-600">Try refining your search term or switching tabs with Tab.</span>
                </div>
              )}
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.file}-${item.line}-${item.column}-${idx}`}
                  onClick={() => {
                    onSelectResult(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs ${
                    isSelected
                      ? mode === "files"
                        ? "bg-cyan-950/60 border border-cyan-500/40 text-white"
                        : mode === "content"
                        ? "bg-purple-950/60 border border-purple-500/40 text-white"
                        : "bg-amber-950/60 border border-amber-500/40 text-white"
                      : "text-zinc-300 hover:bg-[#141414] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Icon based on match_type */}
                    {item.match_type === "function" ? (
                      <div className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/30 text-[10px] font-bold shrink-0">
                        def
                      </div>
                    ) : item.match_type === "class" ? (
                      <div className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-400 border border-purple-500/30 text-[10px] font-bold shrink-0">
                        class
                      </div>
                    ) : item.match_type === "content" ? (
                      <div className="w-5 h-5 rounded bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <Hash className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <FileText className="w-3 h-3" />
                      </div>
                    )}

                    {/* Path & Preview */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100 truncate">{item.filename}</span>
                        {item.line > 0 && (
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            Line {item.line}:{item.column}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 truncate">{item.file}</span>
                      </div>
                      
                      {item.preview && item.match_type !== "file" && (
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                          {item.preview}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enter Key Action Indicator */}
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 pl-2 shrink-0">
                      <span>Jump</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 3. Footer Shortcuts */}
        <div className="p-2.5 bg-[#050505] border-t border-[#1f1f1f] flex items-center justify-between text-[10px] text-zinc-500 select-none">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-[#18181b] text-zinc-300">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-[#18181b] text-zinc-300">↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#18181b] text-zinc-300">Tab</kbd> Mode</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#18181b] text-zinc-300">↵</kbd> Open & Reveal</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#18181b] text-zinc-300">Esc</kbd> Close</span>
          </div>
          <div className="text-zinc-600">
            {workspacePath.split("/").pop()}
          </div>
        </div>

      </div>
    </div>
  );
}
