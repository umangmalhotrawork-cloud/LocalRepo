"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

export interface SearchMatchItem {
  matchId: string;
  file: string;
  filePath: string;
  fullPath: string;
  line: number;
  column: number;
  text: string;
  lineText: string;
  matchText: string;
  matchStart: number;
  matchEnd: number;
  replacement?: string;
  selected?: boolean;
}

export interface PreviewFileItem {
  filePath: string;
  fullPath: string;
  originalContent: string;
  proposedContent: string;
  matches: SearchMatchItem[];
  selectedMatches: string[];
  selected: boolean;
  changeType: "MODIFY" | "UNCHANGED" | "ADD" | "DELETE";
}

export interface ReplacementPreviewModel {
  previewId: string;
  searchId: string;
  query: string;
  replaceText: string;
  files: PreviewFileItem[];
  totalReplacements: number;
  totalFiles: number;
  durationMs: number;
}

export function useSearch(workspacePath: string = "") {
  const [query, setQuery] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState<boolean>(false);
  const [isWholeWord, setIsWholeWord] = useState<boolean>(false);
  const [includeHidden, setIncludeHidden] = useState<boolean>(false);
  const [includeGlobs, setIncludeGlobs] = useState<string>("");
  const [excludeGlobs, setExcludeGlobs] = useState<string>("");

  const [results, setResults] = useState<SearchMatchItem[]>([]);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(-1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);

  // Multi-File Replacement Preview State (Milestone 27)
  const [previewModel, setPreviewModel] = useState<ReplacementPreviewModel | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [activePreviewFilePath, setActivePreviewFilePath] = useState<string | null>(null);
  const [changeSetRisk, setChangeSetRisk] = useState<any>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;

  const groupedResults = useMemo(() => {
    const map: Record<string, SearchMatchItem[]> = {};
    for (const res of results) {
      const f = res.filePath || res.file;
      if (!map[f]) {
        map[f] = [];
      }
      map[f].push(res);
    }
    return map;
  }, [results]);

  const executeSearch = useCallback(
    async (q: string) => {
      const ws = workspaceRef.current;
      if (!ws || !q || !q.trim()) {
        setResults([]);
        setTotalFiles(0);
        setTotalMatches(0);
        setSelectedResultIndex(-1);
        setLoading(false);
        setError(null);
        return;
      }

      const searchApi = (window as any)?.electronAPI?.search;
      if (typeof window === "undefined" || !searchApi) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const includeList = includeGlobs.split(",").map((s) => s.trim()).filter(Boolean);
        const excludeList = excludeGlobs.split(",").map((s) => s.trim()).filter(Boolean);

        const res = await searchApi.run({
          workspacePath: ws,
          query: q,
          isRegex,
          isCaseSensitive,
          isWholeWord,
          includeHidden,
          includeGlobs: includeList,
          excludeGlobs: excludeList,
          maxResults: 5000,
        });

        if (res && res.success) {
          const formattedResults: SearchMatchItem[] = (res.results || res.matches || []).map((m: any) => ({
            matchId: m.matchId || `${m.file || m.filePath}:${m.line}:${m.column}:${m.matchStart}`,
            file: m.file || m.filePath,
            filePath: m.filePath || m.file,
            fullPath: m.fullPath,
            line: m.line,
            column: m.column,
            text: m.text || m.lineText,
            lineText: m.lineText || m.text,
            matchText: m.matchText,
            matchStart: m.matchStart,
            matchEnd: m.matchEnd,
          }));

          setResults(formattedResults);
          setTotalFiles(res.totalFiles || res.affectedFiles || 0);
          setTotalMatches(res.totalMatches || formattedResults.length);
          setDurationMs(res.durationMs || 0);
          setSelectedResultIndex(formattedResults.length > 0 ? 0 : -1);
        } else {
          setError(res?.error || "Search failed");
          setResults([]);
          setTotalFiles(0);
          setTotalMatches(0);
          setSelectedResultIndex(-1);
        }
      } catch (err: any) {
        setError(err.message || String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [isRegex, isCaseSensitive, isWholeWord, includeHidden, includeGlobs, excludeGlobs]
  );

  // Debounced search trigger on query or toggle change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query || !query.trim()) {
      setResults([]);
      setTotalFiles(0);
      setTotalMatches(0);
      setSelectedResultIndex(-1);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(query);
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isRegex, isCaseSensitive, isWholeWord, includeHidden, includeGlobs, excludeGlobs, executeSearch]);

  /**
   * Generates multi-file replacement preview model and safety analysis
   */
  const generatePreview = useCallback(async () => {
    const ws = workspaceRef.current;
    const searchApi = (window as any)?.electronAPI?.search;
    if (!ws || !searchApi?.previewReplace || !query.trim()) return;

    setPreviewLoading(true);
    setError(null);

    try {
      const includeList = includeGlobs.split(",").map((s) => s.trim()).filter(Boolean);
      const excludeList = excludeGlobs.split(",").map((s) => s.trim()).filter(Boolean);

      const previewRes = await searchApi.previewReplace({
        workspacePath: ws,
        query,
        replaceText,
        isRegex,
        isCaseSensitive,
        isWholeWord,
        includeHidden,
        includeGlobs: includeList,
        excludeGlobs: excludeList,
      });

      if (previewRes && previewRes.success) {
        setPreviewModel(previewRes);
        setIsPreviewOpen(true);
        if (previewRes.files && previewRes.files.length > 0) {
          setActivePreviewFilePath(previewRes.files[0].filePath);
        }

        // Pre-evaluate ChangeSet safety
        if (searchApi.generateChangeSet) {
          try {
            const csRes = await searchApi.generateChangeSet({
              workspacePath: ws,
              preview: previewRes,
            });
            if (csRes && csRes.risk) {
              setChangeSetRisk(csRes.risk);
            }
          } catch (csErr) {
            console.warn("[USE-SEARCH] ChangeSet safety check error:", csErr);
          }
        }
      } else {
        setError(previewRes?.error || "Failed to generate replacement preview");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [query, replaceText, isRegex, isCaseSensitive, isWholeWord, includeHidden, includeGlobs, excludeGlobs]);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewModel(null);
    setActivePreviewFilePath(null);
    setChangeSetRisk(null);
  }, []);

  /**
   * Toggles match selection within the replacement preview model
   */
  const toggleMatchSelection = useCallback(
    (filePath: string, matchId: string) => {
      setPreviewModel((prev) => {
        if (!prev) return null;
        const updatedFiles = prev.files.map((file) => {
          if (file.filePath !== filePath) return file;

          const updatedMatches = file.matches.map((m) => {
            if (m.matchId === matchId) {
              return { ...m, selected: !m.selected };
            }
            return m;
          });

          const selectedMatchIds = updatedMatches.filter((m) => m.selected).map((m) => m.matchId);
          const isFileSelected = selectedMatchIds.length > 0;

          // Re-compute proposedContent locally
          const lines = file.originalContent.split(/\r?\n/);
          const lineMatchMap = new Map<number, SearchMatchItem[]>();
          for (const m of updatedMatches) {
            if (!lineMatchMap.has(m.line)) lineMatchMap.set(m.line, []);
            lineMatchMap.get(m.line)!.push(m);
          }

          const proposedLines = lines.map((originalLine, lineIdx) => {
            const lineMatches = lineMatchMap.get(lineIdx + 1);
            if (!lineMatches || lineMatches.length === 0) return originalLine;

            const sorted = [...lineMatches].sort((a, b) => b.matchStart - a.matchStart);
            let updated = originalLine;
            for (const sm of sorted) {
              if (!sm.selected) continue;
              updated = updated.slice(0, sm.matchStart) + (sm.replacement ?? replaceText) + updated.slice(sm.matchEnd);
            }
            return updated;
          });

          const proposedContent = proposedLines.join("\n");

          return {
            ...file,
            matches: updatedMatches,
            selectedMatches: selectedMatchIds,
            selected: isFileSelected,
            proposedContent,
            changeType: (proposedContent === file.originalContent ? "UNCHANGED" : "MODIFY") as "UNCHANGED" | "MODIFY",
          };
        });

        const totalReplacements = updatedFiles.reduce((acc, f) => acc + f.selectedMatches.length, 0);
        const totalSelectedFiles = updatedFiles.filter((f) => f.selected).length;

        return {
          ...prev,
          files: updatedFiles,
          totalReplacements,
          totalFiles: totalSelectedFiles,
        };
      });
    },
    [replaceText]
  );

  /**
   * Toggles entire file selection (select/deselect all matches in that file)
   */
  const toggleFileSelection = useCallback(
    (filePath: string) => {
      setPreviewModel((prev) => {
        if (!prev) return null;
        const target = prev.files.find((f) => f.filePath === filePath);
        if (!target) return prev;
        const shouldSelect = !target.selected;

        const updatedFiles = prev.files.map((file) => {
          if (file.filePath !== filePath) return file;

          const updatedMatches = file.matches.map((m) => ({ ...m, selected: shouldSelect }));
          const selectedMatchIds = shouldSelect ? updatedMatches.map((m) => m.matchId) : [];

          // Re-compute proposed content
          const lines = file.originalContent.split(/\r?\n/);
          const lineMatchMap = new Map<number, SearchMatchItem[]>();
          for (const m of updatedMatches) {
            if (!lineMatchMap.has(m.line)) lineMatchMap.set(m.line, []);
            lineMatchMap.get(m.line)!.push(m);
          }

          const proposedLines = lines.map((originalLine, lineIdx) => {
            const lineMatches = lineMatchMap.get(lineIdx + 1);
            if (!lineMatches || lineMatches.length === 0) return originalLine;

            const sorted = [...lineMatches].sort((a, b) => b.matchStart - a.matchStart);
            let updated = originalLine;
            for (const sm of sorted) {
              if (!sm.selected) continue;
              updated = updated.slice(0, sm.matchStart) + (sm.replacement ?? replaceText) + updated.slice(sm.matchEnd);
            }
            return updated;
          });

          const proposedContent = proposedLines.join("\n");

          return {
            ...file,
            matches: updatedMatches,
            selectedMatches: selectedMatchIds,
            selected: shouldSelect,
            proposedContent,
            changeType: (proposedContent === file.originalContent ? "UNCHANGED" : "MODIFY") as "UNCHANGED" | "MODIFY",
          };
        });

        const totalReplacements = updatedFiles.reduce((acc, f) => acc + f.selectedMatches.length, 0);
        const totalSelectedFiles = updatedFiles.filter((f) => f.selected).length;

        return {
          ...prev,
          files: updatedFiles,
          totalReplacements,
          totalFiles: totalSelectedFiles,
        };
      });
    },
    [replaceText]
  );

  /**
   * Selects all matches across all files in the preview
   */
  const selectAllMatches = useCallback(() => {
    setPreviewModel((prev) => {
      if (!prev) return null;
      const updatedFiles = prev.files.map((file) => {
        const updatedMatches = file.matches.map((m) => ({ ...m, selected: true }));
        const lines = file.originalContent.split(/\r?\n/);
        const lineMatchMap = new Map<number, SearchMatchItem[]>();
        for (const m of updatedMatches) {
          if (!lineMatchMap.has(m.line)) lineMatchMap.set(m.line, []);
          lineMatchMap.get(m.line)!.push(m);
        }

        const proposedLines = lines.map((originalLine, lineIdx) => {
          const lineMatches = lineMatchMap.get(lineIdx + 1);
          if (!lineMatches || lineMatches.length === 0) return originalLine;

          const sorted = [...lineMatches].sort((a, b) => b.matchStart - a.matchStart);
          let updated = originalLine;
          for (const sm of sorted) {
            updated = updated.slice(0, sm.matchStart) + (sm.replacement ?? replaceText) + updated.slice(sm.matchEnd);
          }
          return updated;
        });

        return {
          ...file,
          matches: updatedMatches,
          selectedMatches: updatedMatches.map((m) => m.matchId),
          selected: true,
          proposedContent: proposedLines.join("\n"),
          changeType: "MODIFY" as const,
        };
      });

      return {
        ...prev,
        files: updatedFiles,
        totalReplacements: updatedFiles.reduce((acc, f) => acc + f.selectedMatches.length, 0),
        totalFiles: updatedFiles.length,
      };
    });
  }, [replaceText]);

  /**
   * Deselects all matches across all files in the preview
   */
  const deselectAllMatches = useCallback(() => {
    setPreviewModel((prev) => {
      if (!prev) return null;
      const updatedFiles = prev.files.map((file) => ({
        ...file,
        matches: file.matches.map((m) => ({ ...m, selected: false })),
        selectedMatches: [],
        selected: false,
        proposedContent: file.originalContent,
        changeType: "UNCHANGED" as const,
      }));

      return {
        ...prev,
        files: updatedFiles,
        totalReplacements: 0,
        totalFiles: 0,
      };
    });
  }, []);

  /**
   * Executes atomic multi-file replacement transaction via TransactionalPatchApplier
   */
  const applyReplacementChangeSet = useCallback(async () => {
    const ws = workspaceRef.current;
    const searchApi = (window as any)?.electronAPI?.search;
    if (!ws || !searchApi?.applyReplace || !previewModel) return false;

    setIsApplying(true);
    setError(null);

    try {
      const selectedFiles = previewModel.files.filter((f) => f.selected && f.proposedContent !== f.originalContent);
      if (selectedFiles.length === 0) {
        closePreview();
        return true;
      }

      const res = await searchApi.applyReplace({
        workspacePath: ws,
        files: selectedFiles,
        force: true,
      });

      if (res && res.success) {
        closePreview();
        await executeSearch(query);
        return true;
      } else {
        setError(res?.error || "Transaction apply failed and was safely rolled back.");
        return false;
      }
    } catch (err: any) {
      setError(err.message || String(err));
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [previewModel, query, executeSearch, closePreview]);

  const replaceSingle = useCallback(
    async (match: SearchMatchItem) => {
      const ws = workspaceRef.current;
      const searchApi = (window as any)?.electronAPI?.search;
      if (!ws || !searchApi) return false;

      try {
        const res = await searchApi.replace({
          workspacePath: ws,
          file: match.filePath || match.file,
          line: match.line,
          column: match.column,
          matchText: match.matchText,
          replaceText,
        });

        if (res && res.success) {
          executeSearch(query);
          return true;
        }
        return false;
      } catch (err: any) {
        setError(err.message || String(err));
        return false;
      }
    },
    [query, replaceText, executeSearch]
  );

  const replaceAllInFile = useCallback(
    async (file: string) => {
      const ws = workspaceRef.current;
      const searchApi = (window as any)?.electronAPI?.search;
      if (!ws || !searchApi || !query) return false;

      try {
        const res = await searchApi.replaceAll({
          workspacePath: ws,
          query,
          replaceText,
          isRegex,
          isCaseSensitive,
          isWholeWord,
          fileFilter: file,
        });

        if (res && res.success) {
          executeSearch(query);
          return true;
        }
        return false;
      } catch (err: any) {
        setError(err.message || String(err));
        return false;
      }
    },
    [query, replaceText, isRegex, isCaseSensitive, isWholeWord, executeSearch]
  );

  const replaceAllInWorkspace = useCallback(async () => {
    // Open preview by default for safe replacement
    await generatePreview();
  }, [generatePreview]);

  const navigateResult = useCallback(
    (direction: "next" | "prev") => {
      if (results.length === 0) return null;
      let nextIndex = selectedResultIndex;

      if (direction === "next") {
        nextIndex = (selectedResultIndex + 1) % results.length;
      } else {
        nextIndex = (selectedResultIndex - 1 + results.length) % results.length;
      }

      setSelectedResultIndex(nextIndex);
      return results[nextIndex];
    },
    [results, selectedResultIndex]
  );

  const activePreviewFile = useMemo(() => {
    if (!previewModel || !activePreviewFilePath) return null;
    return previewModel.files.find((f) => f.filePath === activePreviewFilePath) || null;
  }, [previewModel, activePreviewFilePath]);

  return {
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
    includeGlobs,
    setIncludeGlobs,
    excludeGlobs,
    setExcludeGlobs,
    results,
    groupedResults,
    totalFiles,
    totalMatches,
    selectedResultIndex,
    setSelectedResultIndex,
    loading,
    error,
    durationMs,
    refreshSearch: () => executeSearch(query),
    replaceSingle,
    replaceAllInFile,
    replaceAllInWorkspace,
    navigateResult,
    // Preview & ChangeSet (Milestone 27)
    previewModel,
    isPreviewOpen,
    previewLoading,
    activePreviewFile,
    setActivePreviewFilePath,
    changeSetRisk,
    isApplying,
    generatePreview,
    closePreview,
    toggleMatchSelection,
    toggleFileSelection,
    selectAllMatches,
    deselectAllMatches,
    applyReplacementChangeSet,
  };
}

