"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search as SearchIcon,
  Replace,
  ChevronRight,
  ChevronDown,
  FileText,
  Check,
  AlertCircle,
  Clock,
  ArrowDown,
  ArrowUp,
  X,
  Layers,
  RefreshCw,
} from "lucide-react";
import { SearchMatchItem } from "../hooks/useSearch";

interface SearchPanelProps {
  query: string;
  setQuery: (q: string) => void;
  replaceText: string;
  setReplaceText: (r: string) => void;
  isRegex: boolean;
  setIsRegex: (val: boolean | ((prev: boolean) => boolean)) => void;
  isCaseSensitive: boolean;
  setIsCaseSensitive: (val: boolean | ((prev: boolean) => boolean)) => void;
  isWholeWord: boolean;
  setIsWholeWord: (val: boolean | ((prev: boolean) => boolean)) => void;
  includeHidden: boolean;
  setIncludeHidden: (val: boolean | ((prev: boolean) => boolean)) => void;
  results: SearchMatchItem[];
  groupedResults: Record<string, SearchMatchItem[]>;
  totalFiles: number;
  totalMatches: number;
  selectedResultIndex: number;
  loading: boolean;
  error: string | null;
  durationMs: number;
  onSelectMatch: (match: SearchMatchItem, index: number) => void;
  onReplaceSingle: (match: SearchMatchItem) => void;
  onReplaceAllInFile: (file: string) => void;
  onReplaceAllInWorkspace: () => void;
  onNavigateResult: (direction: "next" | "prev") => SearchMatchItem | null;
}

export default function SearchPanel({
  query,
  setQuery,
  replaceText,
  setReplaceText,
  isRegex,
  setIsRegex,
  isCaseSensitive,
  setIsCaseSensitive,
  isWholeWord,
  setIsWholeWord,
  includeHidden,
  setIncludeHidden,
  results,
  groupedResults,
  totalFiles,
  totalMatches,
  selectedResultIndex,
  loading,
  error,
  durationMs,
  onSelectMatch,
  onReplaceSingle,
  onReplaceAllInFile,
  onReplaceAllInWorkspace,
  onNavigateResult,
}: SearchPanelProps) {
  const [showReplace, setShowReplace] = useState<boolean>(true);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const toggleFileCollapse = (file: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [file]: !prev[file] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const match = onNavigateResult(e.shiftKey ? "prev" : "next");
      if (match) {
        const idx = results.findIndex(
          (r) => r.file === match.file && r.line === match.line && r.column === match.column
        );
        if (idx >= 0) onSelectMatch(match, idx);
      }
    }
  };

  const selectedMatch = results[selectedResultIndex] || null;

  return (
    <div className="h-full flex flex-col bg-[#050507] border-r border-[#1f1f1f] font-mono text-xs select-none overflow-hidden">
      {/* Top Header */}
      <div className="h-10 bg-[#0a0a0d] border-b border-[#1f1f1f] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SearchIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wide text-[11px]">
            Search & Replace
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowReplace((prev) => !prev)}
            className={`p-1 rounded transition-all cursor-pointer ${
              showReplace ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" : "text-zinc-400 hover:text-white"
            }`}
            title="Toggle Replace Box"
          >
            <Replace className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inputs Area */}
      <div className="p-3 bg-[#08080a] border-b border-[#1f1f1f] space-y-2 shrink-0">
        {/* Search Input Box with Toggles */}
        <div className="relative flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search (e.g. function, class, symbol)..."
            className="w-full bg-[#121215] border border-[#27272a] focus:border-cyan-500/60 rounded px-2.5 py-1.5 pr-24 text-zinc-100 placeholder:text-zinc-600 outline-none text-xs font-mono"
          />

          {/* Toggle Switches */}
          <div className="absolute right-1.5 flex items-center gap-0.5">
            <button
              onClick={() => setIsCaseSensitive((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                isCaseSensitive
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Match Case (Aa)"
            >
              Aa
            </button>
            <button
              onClick={() => setIsWholeWord((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                isWholeWord
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Match Whole Word (\b)"
            >
              \b
            </button>
            <button
              onClick={() => setIsRegex((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                isRegex
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Use Regular Expression (.*)"
            >
              .*
            </button>
          </div>
        </div>

        {/* Replace Input Box */}
        {showReplace && (
          <div className="space-y-1.5 animate-fadeIn">
            <div className="relative flex items-center">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="w-full bg-[#121215] border border-[#27272a] focus:border-cyan-500/60 rounded px-2.5 py-1.5 pr-20 text-zinc-100 placeholder:text-zinc-600 outline-none text-xs font-mono"
              />

              {/* Replace Action Buttons */}
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  disabled={!selectedMatch || !query.trim()}
                  onClick={() => selectedMatch && onReplaceSingle(selectedMatch)}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-[10px] font-bold disabled:opacity-30 cursor-pointer"
                  title="Replace Selected Match"
                >
                  1
                </button>
                <button
                  disabled={totalMatches === 0 || !query.trim()}
                  onClick={onReplaceAllInWorkspace}
                  className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold disabled:opacity-30 cursor-pointer"
                  title="Replace All Occurrences in Workspace"
                >
                  All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats & Navigation Bar */}
        <div className="flex items-center justify-between text-zinc-400 text-[10.5px] pt-1">
          <div className="flex items-center gap-1.5">
            {loading ? (
              <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
            ) : (
              <Layers className="w-3 h-3 text-cyan-400" />
            )}
            <span>
              {totalMatches} match{totalMatches === 1 ? "" : "es"} in {totalFiles} file{totalFiles === 1 ? "" : "s"}
            </span>
            {durationMs > 0 && <span className="text-zinc-600">({durationMs}ms)</span>}
          </div>

          {totalMatches > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 font-mono">
                {selectedResultIndex >= 0 ? selectedResultIndex + 1 : 0} of {totalMatches}
              </span>
              <button
                onClick={() => {
                  const m = onNavigateResult("prev");
                  if (m) {
                    const idx = results.findIndex((r) => r === m);
                    onSelectMatch(m, idx >= 0 ? idx : 0);
                  }
                }}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                title="Previous Match (Shift+Enter)"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  const m = onNavigateResult("next");
                  if (m) {
                    const idx = results.findIndex((r) => r === m);
                    onSelectMatch(m, idx >= 0 ? idx : 0);
                  }
                }}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                title="Next Match (Enter)"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-2 rounded bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[10.5px] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Object.entries(groupedResults).map(([file, fileMatches]) => {
          const isCollapsed = !!collapsedFiles[file];
          return (
            <div key={file} className="border border-[#1f1f1f] rounded-lg overflow-hidden bg-[#09090b]">
              {/* File Header */}
              <div
                onClick={() => toggleFileCollapse(file)}
                className="px-2.5 py-1.5 bg-[#0d0d10] hover:bg-[#141418] flex items-center justify-between cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  )}
                  <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="font-bold text-zinc-200 text-[11px] truncate" title={file}>
                    {file}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 text-[10px] font-bold">
                    {fileMatches.length}
                  </span>
                  {showReplace && replaceText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReplaceAllInFile(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-cyan-950 text-zinc-400 hover:text-cyan-300 text-[9.5px] transition-all cursor-pointer"
                      title="Replace All in this file"
                    >
                      Replace in file
                    </button>
                  )}
                </div>
              </div>

              {/* Match Items in File */}
              {!isCollapsed && (
                <div className="p-1 space-y-0.5">
                  {fileMatches.map((match) => {
                    const globalIdx = results.findIndex((r) => r === match);
                    const isSelected = globalIdx === selectedResultIndex;

                    const beforeText = match.text.slice(0, match.matchStart);
                    const matchedSubstring = match.matchText;
                    const afterText = match.text.slice(match.matchEnd);

                    return (
                      <div
                        key={`${match.file}:${match.line}:${match.column}`}
                        onClick={() => onSelectMatch(match, globalIdx)}
                        className={`px-2 py-1 rounded flex items-start gap-2 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-cyan-950/70 border border-cyan-500/40 text-cyan-100 font-bold"
                            : "hover:bg-[#121216] text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-8 text-right">
                          {match.line}:
                        </span>
                        <div className="flex-1 font-mono text-[11px] truncate leading-tight">
                          <span>{beforeText}</span>
                          <mark className="bg-amber-400 text-black px-0.5 rounded font-bold">
                            {matchedSubstring}
                          </mark>
                          <span>{afterText}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {query && !loading && results.length === 0 && (
          <div className="py-8 text-center text-zinc-600 text-xs">
            <SearchIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
            <div>No matching results found in workspace</div>
          </div>
        )}
      </div>
    </div>
  );
}
