"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

export interface SearchMatchItem {
  file: string;
  fullPath: string;
  line: number;
  column: number;
  text: string;
  matchText: string;
  matchStart: number;
  matchEnd: number;
}

export function useSearch(workspacePath: string = "") {
  const [query, setQuery] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState<boolean>(false);
  const [isWholeWord, setIsWholeWord] = useState<boolean>(false);
  const [includeHidden, setIncludeHidden] = useState<boolean>(false);

  const [results, setResults] = useState<SearchMatchItem[]>([]);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(-1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;

  const groupedResults = useMemo(() => {
    const map: Record<string, SearchMatchItem[]> = {};
    for (const res of results) {
      if (!map[res.file]) {
        map[res.file] = [];
      }
      map[res.file].push(res);
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

      if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.search) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await window.electronAPI.search.run({
          workspacePath: ws,
          query: q,
          isRegex,
          isCaseSensitive,
          isWholeWord,
          includeHidden,
          maxResults: 5000,
        });

        if (res.success) {
          setResults(res.results || []);
          setTotalFiles(res.totalFiles || 0);
          setTotalMatches(res.totalMatches || 0);
          setDurationMs(res.durationMs || 0);
          setSelectedResultIndex(res.results && res.results.length > 0 ? 0 : -1);
        } else {
          setError(res.error || "Search failed");
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
    [isRegex, isCaseSensitive, isWholeWord, includeHidden]
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
  }, [query, isRegex, isCaseSensitive, isWholeWord, includeHidden, executeSearch]);

  const replaceSingle = useCallback(
    async (match: SearchMatchItem) => {
      const ws = workspaceRef.current;
      if (!ws || !window.electronAPI?.search) return false;

      try {
        const res = await window.electronAPI.search.replace({
          workspacePath: ws,
          file: match.file,
          line: match.line,
          column: match.column,
          matchText: match.matchText,
          replaceText,
        });

        if (res.success) {
          // Refresh search
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
      if (!ws || !window.electronAPI?.search || !query) return false;

      try {
        const res = await window.electronAPI.search.replaceAll({
          workspacePath: ws,
          query,
          replaceText,
          isRegex,
          isCaseSensitive,
          isWholeWord,
          fileFilter: file,
        });

        if (res.success) {
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
    const ws = workspaceRef.current;
    if (!ws || !window.electronAPI?.search || !query) return false;

    try {
      const res = await window.electronAPI.search.replaceAll({
        workspacePath: ws,
        query,
        replaceText,
        isRegex,
        isCaseSensitive,
        isWholeWord,
      });

      if (res.success) {
        executeSearch(query);
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || String(err));
      return false;
    }
  }, [query, replaceText, isRegex, isCaseSensitive, isWholeWord, executeSearch]);

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
  };
}
