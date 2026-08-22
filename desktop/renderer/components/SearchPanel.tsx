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
  Filter,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  GitPullRequest,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  SearchMatchItem,
  ReplacementPreviewModel,
  PreviewFileItem,
} from "../hooks/useSearch";

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
  includeGlobs?: string;
  setIncludeGlobs?: (g: string) => void;
  excludeGlobs?: string;
  setExcludeGlobs?: (g: string) => void;
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
  // Milestone 27: Multi-File Replacement Preview Props
  previewModel?: ReplacementPreviewModel | null;
  isPreviewOpen?: boolean;
  previewLoading?: boolean;
  activePreviewFile?: PreviewFileItem | null;
  setActivePreviewFilePath?: (p: string) => void;
  changeSetRisk?: any;
  isApplying?: boolean;
  onGeneratePreview?: () => void;
  onClosePreview?: () => void;
  onToggleMatchSelection?: (filePath: string, matchId: string) => void;
  onToggleFileSelection?: (filePath: string) => void;
  onSelectAllMatches?: () => void;
  onDeselectAllMatches?: () => void;
  onApplyReplacementChangeSet?: () => void;
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
  includeGlobs = "",
  setIncludeGlobs,
  excludeGlobs = "",
  setExcludeGlobs,
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
  previewModel,
  isPreviewOpen = false,
  previewLoading = false,
  activePreviewFile,
  setActivePreviewFilePath,
  changeSetRisk,
  isApplying = false,
  onGeneratePreview,
  onClosePreview,
  onToggleMatchSelection,
  onToggleFileSelection,
  onSelectAllMatches,
  onDeselectAllMatches,
  onApplyReplacementChangeSet,
}: SearchPanelProps) {
  const [showReplace, setShowReplace] = useState<boolean>(true);
  const [showGlobs, setShowGlobs] = useState<boolean>(false);
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
          (r) => (r.filePath || r.file) === (match.filePath || match.file) && r.line === match.line && r.column === match.column
        );
        if (idx >= 0) onSelectMatch(match, idx);
      }
    }
  };

  const selectedMatch = results[selectedResultIndex] || null;

  return (
    <div className="h-full flex flex-col bg-[#050507] border-r border-[#1f1f1f] font-mono text-xs select-none overflow-hidden relative">
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
            onClick={() => setShowGlobs((prev) => !prev)}
            className={`p-1 rounded transition-all cursor-pointer ${
              showGlobs || includeGlobs || excludeGlobs
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Toggle Include/Exclude File Filters"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
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
                className="w-full bg-[#121215] border border-[#27272a] focus:border-cyan-500/60 rounded px-2.5 py-1.5 pr-28 text-zinc-100 placeholder:text-zinc-600 outline-none text-xs font-mono"
              />

              {/* Replace Action Buttons */}
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  disabled={!selectedMatch || !query.trim()}
                  onClick={() => selectedMatch && onReplaceSingle(selectedMatch)}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-[10px] font-bold disabled:opacity-30 cursor-pointer"
                  title="Replace Selected Match (Single)"
                >
                  1
                </button>
                <button
                  disabled={totalMatches === 0 || !query.trim() || previewLoading}
                  onClick={() => (onGeneratePreview ? onGeneratePreview() : onReplaceAllInWorkspace())}
                  className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  title="Preview & Replace All with Safety Inspection"
                >
                  {previewLoading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : "Preview"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Glob Filters Section */}
        {showGlobs && (
          <div className="p-2 rounded bg-[#101014] border border-[#202028] space-y-1.5 animate-fadeIn">
            <div>
              <div className="text-[10px] text-zinc-400 mb-0.5">Files to include (e.g. src/**, *.ts):</div>
              <input
                type="text"
                value={includeGlobs}
                onChange={(e) => setIncludeGlobs && setIncludeGlobs(e.target.value)}
                placeholder="*.ts, src/**"
                className="w-full bg-[#14141a] border border-[#272730] rounded px-2 py-1 text-zinc-200 placeholder:text-zinc-600 outline-none text-[11px]"
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 mb-0.5">Files to exclude (e.g. *.test.js, dist/**):</div>
              <input
                type="text"
                value={excludeGlobs}
                onChange={(e) => setExcludeGlobs && setExcludeGlobs(e.target.value)}
                placeholder="dist/**, *.spec.ts"
                className="w-full bg-[#14141a] border border-[#272730] rounded px-2 py-1 text-zinc-200 placeholder:text-zinc-600 outline-none text-[11px]"
              />
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

                    const beforeText = (match.text || match.lineText || "").slice(0, match.matchStart);
                    const matchedSubstring = match.matchText;
                    const afterText = (match.text || match.lineText || "").slice(match.matchEnd);

                    return (
                      <div
                        key={`${match.filePath || match.file}:${match.line}:${match.column}`}
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

      {/* MULTI-FILE REPLACEMENT PREVIEW MODAL (Milestone 27) */}
      {isPreviewOpen && previewModel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn font-mono"
          onClick={(e) => {
            if (e.target === e.currentTarget && onClosePreview) onClosePreview();
          }}
        >
          <div className="bg-[#0b0b0f] border border-[#272733] rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-[#0e0e13] border-b border-[#20202a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  <GitPullRequest className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100">Multi-File Replacement Preview</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      ChangeSet Pipeline
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                    <span>
                      Replacing &quot;<span className="text-amber-300 font-bold">{previewModel.query}</span>&quot; with &quot;
                      <span className="text-emerald-300 font-bold">{previewModel.replaceText}</span>&quot;
                    </span>
                    <span>•</span>
                    <span>
                      {previewModel.totalReplacements} replacement{previewModel.totalReplacements === 1 ? "" : "s"} across{" "}
                      {previewModel.totalFiles} file{previewModel.totalFiles === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Safety Assessment Badge */}
              <div className="flex items-center gap-3">
                {changeSetRisk && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold ${
                      changeSetRisk.overallRiskLevel === "BLOCKED"
                        ? "bg-rose-950/80 border-rose-500/40 text-rose-300"
                        : changeSetRisk.overallRiskLevel === "HIGH_RISK"
                        ? "bg-amber-950/80 border-amber-500/40 text-amber-300"
                        : "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                    }`}
                  >
                    {changeSetRisk.overallRiskLevel === "BLOCKED" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : changeSetRisk.overallRiskLevel === "HIGH_RISK" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Firewall: {changeSetRisk.overallRiskLevel}</span>
                  </div>
                )}

                <button
                  onClick={onClosePreview}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Left File List + Right Diff Inspector */}
            <div className="flex-1 flex min-h-0 divide-x divide-[#20202a]">
              {/* Left Column: Files & Hunks */}
              <div className="w-80 flex flex-col bg-[#07070a] shrink-0">
                {/* Selection Controls */}
                <div className="p-2.5 border-b border-[#20202a] flex items-center justify-between bg-[#0a0a0e]">
                  <span className="text-[11px] text-zinc-400 font-bold">Affected Files ({previewModel.files.length})</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onSelectAllMatches}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      onClick={onDeselectAllMatches}
                      className="text-[10px] text-zinc-400 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* File Tree List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {previewModel.files.map((file) => {
                    const isActive = activePreviewFile?.filePath === file.filePath;
                    return (
                      <div
                        key={file.filePath}
                        className={`border rounded-lg overflow-hidden transition-all ${
                          isActive
                            ? "border-cyan-500/60 bg-[#121218]"
                            : "border-[#202028] bg-[#0c0c10] hover:border-zinc-700"
                        }`}
                      >
                        {/* File Header with Checkbox */}
                        <div
                          onClick={() => setActivePreviewFilePath && setActivePreviewFilePath(file.filePath)}
                          className="px-2.5 py-2 flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleFileSelection) onToggleFileSelection(file.filePath);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 cursor-pointer shrink-0"
                            >
                              {file.selected ? (
                                <CheckSquare className="w-4 h-4 text-cyan-400" />
                              ) : (
                                <Square className="w-4 h-4 text-zinc-600" />
                              )}
                            </button>
                            <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="font-bold text-zinc-200 truncate text-[11px]" title={file.filePath}>
                              {file.filePath}
                            </span>
                          </div>

                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 shrink-0">
                            {file.selectedMatches.length}/{file.matches.length}
                          </span>
                        </div>

                        {/* Individual Match Hunks inside file */}
                        {isActive && (
                          <div className="px-2 pb-2 pt-0.5 space-y-1 border-t border-[#1a1a22] bg-[#09090d]">
                            {file.matches.map((m) => (
                              <div
                                key={m.matchId}
                                onClick={() =>
                                  onToggleMatchSelection && onToggleMatchSelection(file.filePath, m.matchId)
                                }
                                className="flex items-center gap-2 p-1 rounded hover:bg-[#14141c] cursor-pointer text-[10.5px]"
                              >
                                <button type="button" className="shrink-0 text-cyan-400">
                                  {m.selected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-zinc-600" />
                                  )}
                                </button>
                                <span className="text-zinc-500 w-6 text-right">L{m.line}:</span>
                                <span className="text-zinc-300 truncate font-mono">
                                  {m.matchText} → {replaceText}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Diff Preview Inspector */}
              <div className="flex-1 flex flex-col bg-[#050507] min-w-0">
                {activePreviewFile ? (
                  <>
                    <div className="p-3 bg-[#0a0a0e] border-b border-[#20202a] flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-zinc-200">{activePreviewFile.filePath}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            activePreviewFile.changeType === "MODIFY"
                              ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {activePreviewFile.changeType}
                        </span>
                      </div>
                      <div className="text-zinc-400 text-[11px]">
                        {activePreviewFile.selectedMatches.length} of {activePreviewFile.matches.length} matches selected
                      </div>
                    </div>

                    {/* Side-by-Side Comparison */}
                    <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-[#20202a] font-mono text-xs overflow-hidden">
                      {/* Original Source */}
                      <div className="flex flex-col min-h-0 bg-[#08080a]">
                        <div className="px-3 py-1.5 bg-[#0f0f14] text-[10.5px] font-bold text-rose-400 border-b border-[#20202a]">
                          Original Content
                        </div>
                        <div className="flex-1 p-3 overflow-auto text-zinc-300 whitespace-pre font-mono text-[11.5px] leading-relaxed">
                          {activePreviewFile.originalContent}
                        </div>
                      </div>

                      {/* Proposed Transformed Source */}
                      <div className="flex flex-col min-h-0 bg-[#08080a]">
                        <div className="px-3 py-1.5 bg-[#0f0f14] text-[10.5px] font-bold text-emerald-400 border-b border-[#20202a]">
                          Proposed Replacement Content
                        </div>
                        <div className="flex-1 p-3 overflow-auto text-zinc-300 whitespace-pre font-mono text-[11.5px] leading-relaxed">
                          {activePreviewFile.proposedContent}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-600">
                    Select a file on the left to preview changes
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3 bg-[#0d0d12] border-t border-[#20202a] flex items-center justify-between shrink-0">
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Protected by TransactionalPatchApplier & AI Patch Firewall. Atomic multi-file rollback guaranteed.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClosePreview}
                  disabled={isApplying}
                  className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isApplying || previewModel.totalReplacements === 0}
                  onClick={onApplyReplacementChangeSet}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-900/30"
                >
                  {isApplying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying ChangeSet...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Apply Changes ({previewModel.totalReplacements} replacements in {previewModel.totalFiles} files)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

