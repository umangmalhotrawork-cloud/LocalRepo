"use client";

import { useState, useCallback, useEffect } from "react";

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  description: string;
  isAuto: boolean;
  timestamp: number;
  workspacePath: string;
  totalFiles: number;
  openTabsCount?: number;
};

export type SnapshotDiffItem = {
  relativePath: string;
  status: "added" | "deleted" | "modified" | "unchanged";
  oldContent: string | null;
  newContent: string | null;
  unifiedDiff?: string;
};

export type SnapshotComparison = {
  success: boolean;
  snapshotId1: string;
  snapshotId2: string;
  summary: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
    total: number;
  };
  diffs: SnapshotDiffItem[];
};

export function useSnapshots(workspacePath: string) {
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  const refreshSnapshots = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.list) {
        const list = await (window as any).electronAPI.snapshots.list(workspacePath);
        if (Array.isArray(list)) {
          setSnapshots(list);
          if (!selectedSnapshot && list.length > 0) {
            setSelectedSnapshot(list[0]);
          }
        }
      }
    } catch (e) {
      console.error("[SNAPSHOTS] Failed to list snapshots:", e);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, selectedSnapshot]);

  const createSnapshot = useCallback(
    async (
      name: string,
      description: string = "",
      openTabs: Array<{ path: string; name: string }> = [],
      activeTab: string = "",
      dirtyTabs: string[] = [],
      isAuto: boolean = false
    ) => {
      if (!workspacePath) return null;
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.create) {
          const res = await (window as any).electronAPI.snapshots.create({
            workspacePath,
            name,
            description,
            openTabs,
            activeTab,
            dirtyTabs,
            isAuto,
          });
          await refreshSnapshots();
          return res;
        }
      } catch (e) {
        console.error("[SNAPSHOTS] Failed to create snapshot:", e);
      }
      return null;
    },
    [workspacePath, refreshSnapshots]
  );

  const compareSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!workspacePath || !snapshotId) return null;
      setComparing(true);
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.compare) {
          const res = await (window as any).electronAPI.snapshots.compare({
            workspacePath,
            snapshotId1: snapshotId,
          });
          setComparison(res);
          return res;
        }
      } catch (e) {
        console.error("[SNAPSHOTS] Failed to compare snapshot:", e);
      } finally {
        setComparing(false);
      }
      return null;
    },
    [workspacePath]
  );

  const restoreFile = useCallback(
    async (snapshotId: string, relativePath: string) => {
      if (!workspacePath || !snapshotId || !relativePath) return null;
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.restoreFile) {
          const res = await (window as any).electronAPI.snapshots.restoreFile({
            workspacePath,
            snapshotId,
            relativePath,
          });
          await compareSnapshot(snapshotId);
          return res;
        }
      } catch (e) {
        console.error("[SNAPSHOTS] Failed to restore file:", e);
      }
      return null;
    },
    [workspacePath, compareSnapshot]
  );

  const restoreWorkspace = useCallback(
    async (snapshotId: string) => {
      if (!workspacePath || !snapshotId) return null;
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.restoreWorkspace) {
          const res = await (window as any).electronAPI.snapshots.restoreWorkspace({
            workspacePath,
            snapshotId,
          });
          await refreshSnapshots();
          return res;
        }
      } catch (e) {
        console.error("[SNAPSHOTS] Failed to restore workspace:", e);
      }
      return null;
    },
    [workspacePath, refreshSnapshots]
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!workspacePath || !snapshotId) return;
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.snapshots?.delete) {
          await (window as any).electronAPI.snapshots.delete({
            workspacePath,
            snapshotId,
          });
          await refreshSnapshots();
        }
      } catch (e) {
        console.error("[SNAPSHOTS] Failed to delete snapshot:", e);
      }
    },
    [workspacePath, refreshSnapshots]
  );

  useEffect(() => {
    if (workspacePath) {
      refreshSnapshots();
    }
  }, [workspacePath, refreshSnapshots]);

  return {
    snapshots,
    loading,
    selectedSnapshot,
    setSelectedSnapshot,
    comparison,
    setComparison,
    comparing,
    refreshSnapshots,
    createSnapshot,
    compareSnapshot,
    restoreFile,
    restoreWorkspace,
    deleteSnapshot,
  };
}
