"use client";

console.log('[IDE-APP] module evaluated');

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  FolderOpen, FileText, ChevronRight, ChevronDown, Play, Sparkles, 
  Terminal as TerminalIcon, Zap, X, Check, Save, RotateCcw, ArrowRight, 
  Command, Search, Cpu, Layers, Activity, BarChart3, CheckCircle2, AlertTriangle, ShieldCheck,
  LayoutDashboard, Clock, FileSearch, Network, Download
} from "lucide-react";

import ConfirmDialog from "./components/ConfirmDialog";
import CommandPalette from "./components/CommandPalette";
import QuickOpen from "./components/QuickOpen";
import ProvenanceReplayPanel, { Finding, ProvenanceStep } from "./components/ProvenanceReplayPanel";
import WorkspaceDashboard, { WorkspaceReport, WorkspaceFileReport } from "./components/WorkspaceDashboard";
import WorkspaceGraphPanel, { WorkspaceGraph, GraphNode } from "./components/WorkspaceGraphPanel";
import StartupModal from "./components/StartupModal";
import { useWorkspaceState, EditorViewState, WorkspacePersistedState } from "./hooks/useWorkspaceState";
import { buildWorkspaceReport, ReportExportPayload } from "./utils/reportBuilder";
import { exportGraphSvg } from "./utils/exportGraphSvg";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#050505] text-cyan-400 flex items-center justify-center font-mono text-xs">
      Initializing Monaco Code Editor...
    </div>
  ),
});

declare global {
  interface Window {
    electronAPI?: {
      openFolder: () => Promise<{ folderPath: string; tree: any } | null>;
      getDefaultDemoWorkspace: () => Promise<{ folderPath: string; tree: any } | null>;
      readDir: (path: string) => Promise<any>;
      readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      fileExists: (path: string) => Promise<{ success: boolean; exists: boolean }>;
      analyzeFile: (path: string) => Promise<any>;
      previewSafeRemove: (path: string) => Promise<any>;
      applySafeRemove: (path: string, transformedContent: string) => Promise<any>;
      restoreBackup: (path: string) => Promise<any>;
      scanWorkspace: (path: string) => Promise<any>;
      verifyEquivalence: (path: string, transformedContent: string) => Promise<any>;
      buildWorkspaceGraph: (path: string) => Promise<any>;
      loadWorkspaceState: () => Promise<any>;
      saveWorkspaceState: (state: any) => Promise<any>;
      exportWorkspaceReport: (payload: any) => Promise<{ success: boolean; path: string; htmlPath?: string; error?: string }>;
    };
  }
}

export interface VerificationResult {
  verified: boolean;
  status: string;
  original: {
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_ms: number;
  } | null;
  transformed: {
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_ms: number;
  } | null;
  delta_ms: number;
  outputs_match: boolean;
  error?: string;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface TabItem {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
}

interface DiffPreviewData {
  file: string;
  original_source: string;
  transformed_source: string;
  changed_lines: number[];
  ghost_count_before: number;
  ghost_count_after: number;
  causal_luminance_after: number;
}

const defaultDemoTree: FileNode = {
  name: "ai_cart_project",
  path: "demo-workspaces/ai_cart_project",
  isDirectory: true,
  children: [
    {
      name: "src",
      path: "demo-workspaces/ai_cart_project/src",
      isDirectory: true,
      children: [
        { name: "cart_calculator.py", path: "demo-workspaces/ai_cart_project/src/cart_calculator.py", isDirectory: false },
        { name: "checkout_engine.py", path: "demo-workspaces/ai_cart_project/src/checkout_engine.py", isDirectory: false },
        { name: "invoice_processor.py", path: "demo-workspaces/ai_cart_project/src/invoice_processor.py", isDirectory: false },
      ],
    },
    { name: "nullity.toml", path: "demo-workspaces/ai_cart_project/nullity.toml", isDirectory: false },
    { name: "README.md", path: "demo-workspaces/ai_cart_project/README.md", isDirectory: false },
  ],
};

const defaultCartCalculatorCode = `def calculate_cart_total(items, discount_code=None, tax_rate=0.08):
    """
    Calculates total price for cart items with tax, discounts, and shipping.
    Contains AI-generated vacuous identity statements.
    """
    subtotal = sum(item["price"] * item["quantity"] for item in items)
    
    # Vacuous identity operations inserted by LLM codegen
    subtotal = subtotal * 1
    subtotal = subtotal + 0
    subtotal = subtotal - 0
    subtotal = subtotal / 1
    
    discount_amount = 0.0
    if discount_code == "SUMMER10":
        discount_amount = subtotal * 0.10
    elif discount_code == "WELCOME20":
        discount_amount = subtotal * 0.20
        
    taxable_amount = max(0.0, subtotal - discount_amount)
    tax = taxable_amount * tax_rate
    final_total = taxable_amount + tax
    
    return round(final_total, 2)
`;

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py": return "python";
    case "ts":
    case "tsx": return "typescript";
    case "js":
    case "jsx": return "javascript";
    case "json": return "json";
    case "md": return "markdown";
    case "html": return "html";
    case "css": return "css";
    default: return "plaintext";
  }
}

function extractFileList(node: FileNode): { name: string; path: string }[] {
  if (!node.isDirectory) {
    return [{ name: node.name, path: node.path }];
  }
  let result: { name: string; path: string }[] = [];
  if (node.children) {
    for (const child of node.children) {
      result = result.concat(extractFileList(child));
    }
  }
  return result;
}

export default function IDEApp() {
  console.log('[IDE-APP] component render start');

  useEffect(() => {
    console.log('[IDE-APP] mounted');
    return () => console.log('[IDE-APP] unmounted');
  }, []);

  const [folderPath, setFolderPath] = useState<string | null>("demo-workspaces/ai_cart_project");
  const [fileTree, setFileTree] = useState<FileNode | null>(defaultDemoTree);
  const [openTabs, setOpenTabs] = useState<TabItem[]>([
    {
      path: "demo-workspaces/ai_cart_project/src/cart_calculator.py",
      name: "cart_calculator.py",
      content: defaultCartCalculatorCode,
      savedContent: defaultCartCalculatorCode,
      isDirty: false,
    },
  ]);
  const [activeTabPath, setActiveTabPath] = useState<string>("demo-workspaces/ai_cart_project/src/cart_calculator.py");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "demo-workspaces/ai_cart_project": true,
    "demo-workspaces/ai_cart_project/src": true,
  });
  
  const [findings, setFindings] = useState<Finding[]>([
    {
      line: 9,
      code: "subtotal = subtotal * 1",
      title: "Identity Multiplication (x * 1)",
      reason: "Multiplying by 1 leaves output state identical.",
      luminance: 0.0,
      status: "Verified Ghost Line",
      category: "vacuous_identity",
      provenance_chain: [
        { type: "definition", line: 6, code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)" },
        { type: "ghost_operation", line: 9, code: "subtotal = subtotal * 1" },
        { type: "use", line: 16, code: "discount_amount = subtotal * 0.10" },
        { type: "use", line: 20, code: "taxable_amount = max(0.0, subtotal - discount_amount)" },
        { type: "return_sink", line: 24, code: "return round(final_total, 2)" },
      ],
      causal_path_length: 5,
      return_sink_line: 24,
    },
    {
      line: 10,
      code: "subtotal = subtotal + 0",
      title: "Identity Addition (x + 0)",
      reason: "Adding 0 leaves value invariant.",
      luminance: 0.0,
      status: "Verified Ghost Line",
      category: "vacuous_identity",
      provenance_chain: [
        { type: "definition", line: 6, code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)" },
        { type: "ghost_operation", line: 10, code: "subtotal = subtotal + 0" },
        { type: "use", line: 16, code: "discount_amount = subtotal * 0.10" },
        { type: "use", line: 20, code: "taxable_amount = max(0.0, subtotal - discount_amount)" },
        { type: "return_sink", line: 24, code: "return round(final_total, 2)" },
      ],
      causal_path_length: 5,
      return_sink_line: 24,
    },
    {
      line: 11,
      code: "subtotal = subtotal - 0",
      title: "Identity Subtraction (x - 0)",
      reason: "Subtracting 0 exerts zero state leverage.",
      luminance: 0.0,
      status: "Verified Ghost Line",
      category: "vacuous_identity",
      provenance_chain: [
        { type: "definition", line: 6, code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)" },
        { type: "ghost_operation", line: 11, code: "subtotal = subtotal - 0" },
        { type: "use", line: 16, code: "discount_amount = subtotal * 0.10" },
        { type: "use", line: 20, code: "taxable_amount = max(0.0, subtotal - discount_amount)" },
        { type: "return_sink", line: 24, code: "return round(final_total, 2)" },
      ],
      causal_path_length: 5,
      return_sink_line: 24,
    },
    {
      line: 12,
      code: "subtotal = subtotal / 1",
      title: "Identity Division (x / 1)",
      reason: "Dividing by 1 is mathematically redundant.",
      luminance: 0.0,
      status: "Verified Ghost Line",
      category: "vacuous_identity",
      provenance_chain: [
        { type: "definition", line: 6, code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)" },
        { type: "ghost_operation", line: 12, code: "subtotal = subtotal / 1" },
        { type: "use", line: 16, code: "discount_amount = subtotal * 0.10" },
        { type: "use", line: 20, code: "taxable_amount = max(0.0, subtotal - discount_amount)" },
        { type: "return_sink", line: 24, code: "return round(final_total, 2)" },
      ],
      causal_path_length: 5,
      return_sink_line: 24,
    },
  ]);
  type MainView = "editor" | "dashboard" | "graph";
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(findings[0] || null);
  const [workspaceReport, setWorkspaceReport] = useState<WorkspaceReport | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceReport | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceScanLoading, setWorkspaceScanLoading] = useState(false);
  const [mainView, setMainView] = useState<MainView>("editor");
  const [workspaceGraph, setWorkspaceGraph] = useState<WorkspaceGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [startupModalOpen, setStartupModalOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"file" | "project">("file");
  const [luminance, setLuminance] = useState<number>(0.0);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [cursorPositions, setCursorPositions] = useState<Record<string, { line: number; col: number }>>({});

  // Persistence Hook & Editor State Tracking
  const { loadedState, requestSave, hasLoaded } = useWorkspaceState();
  const editorStatesRef = useRef<Record<string, EditorViewState>>({});
  const isStateRestoredRef = useRef<boolean>(false);

  // Modals & Panels State
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffPreviewData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [closeConfirmTab, setCloseConfirmTab] = useState<TabItem | null>(null);

  // Pane Visibility & Resizing
  const [showExplorer, setShowExplorer] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [analysisWidth, setAnalysisWidth] = useState(300);
  const [consoleHeight, setConsoleHeight] = useState(120);

  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Echo Nullity Desktop IDE Engine Initialized.",
    "[ELECTRON] Context Bridge Connected.",
    "[DEMO] Auto-loaded workspace: demo-workspaces/ai_cart_project",
    "[ENGINE] Python analyze.py loaded. 4 Ghost lines detected in cart_calculator.py.",
  ]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRowRef = useRef<HTMLDivElement | null>(null);
  const explorerPanelRef = useRef<HTMLDivElement | null>(null);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const analysisPanelRef = useRef<HTMLDivElement | null>(null);
  const monacoWrapperRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const activeTab = openTabs.find((t) => t.path === activeTabPath) || openTabs[0];

  console.log('[IDE-APP] active file', activeTab?.path, activeTab?.content?.length);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const showToast = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const saveRecentWorkspace = (folder: string) => {
    if (typeof window === "undefined" || !folder) return;
    try {
      setRecentWorkspaces((prev) => {
        const updated = [folder, ...prev.filter((f) => f !== folder)].slice(0, 5);
        localStorage.setItem("echo_recent_workspaces", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn("[IDE-APP] Failed to save recent workspace:", e);
    }
  };

  // Trigger Debounced Auto-Save
  const triggerAutoSave = () => {
    if (!hasLoaded || !folderPath) return;

    if (editorRef.current && activeTabPath) {
      try {
        const pos = editorRef.current.getPosition();
        const sTop = editorRef.current.getScrollTop();
        const sLeft = editorRef.current.getScrollLeft();
        if (pos) {
          editorStatesRef.current[activeTabPath] = {
            cursorLine: pos.lineNumber,
            cursorColumn: pos.column,
            scrollTop: sTop,
            scrollLeft: sLeft,
          };
        }
      } catch (e) {}
    }

    const stateToPersist: WorkspacePersistedState = {
      folderPath,
      openTabs: openTabs.map((t) => ({ path: t.path, name: t.name })),
      activeTabPath: activeTabPath || (openTabs[0]?.path || ""),
      mainView,
      explorerWidth,
      analysisWidth,
      consoleHeight,
      editorStates: editorStatesRef.current,
    };

    requestSave(stateToPersist);
  };

  // Auto-save effect when state changes
  useEffect(() => {
    if (hasLoaded && isStateRestoredRef.current && folderPath) {
      triggerAutoSave();
    }
  }, [folderPath, openTabs, activeTabPath, mainView, explorerWidth, analysisWidth, consoleHeight]);

  // Load demo workspace helper
  const loadDemoWorkspace = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.getDefaultDemoWorkspace) {
        console.log('[IDE-APP] invoking getDefaultDemoWorkspace');
        const demo = await window.electronAPI.getDefaultDemoWorkspace();
        if (demo && demo.tree) {
          setFolderPath(demo.folderPath);
          setFileTree(demo.tree);
          saveRecentWorkspace(demo.folderPath);
          addLog(`[DEMO] Loaded workspace from disk: ${demo.folderPath}`);
          
          const targetPath = `${demo.folderPath}/src/cart_calculator.py`;
          console.log('[IDE-APP] invoking readFile for', targetPath);
          const fileRes = await window.electronAPI.readFile(targetPath);
          if (fileRes.success && fileRes.content) {
            console.log('[IDE-APP] readFile success, content length:', fileRes.content.length);
            const newTab = {
              path: targetPath,
              name: "cart_calculator.py",
              content: fileRes.content,
              savedContent: fileRes.content,
              isDirty: false,
            };
            setOpenTabs([newTab]);
            setActiveTabPath(targetPath);
            runAnalysis(targetPath, fileRes.content);

            console.log('[WORKSPACE] scan start', demo.folderPath);
            setWorkspaceLoading(true);
            setWorkspaceScanLoading(true);
            try {
              const scanRes = await window.electronAPI.scanWorkspace(demo.folderPath);
              if (scanRes && !scanRes.error) {
                setWorkspaceSummary(scanRes);
                setWorkspaceReport(scanRes);
                console.log('[WORKSPACE] scan complete', scanRes);
                console.log('[IDE-APP] Initial workspace scan loaded:', scanRes.files_scanned, 'files');
              }
            } catch (scanErr) {
              console.error('[WORKSPACE] scan error:', scanErr);
            } finally {
              setWorkspaceLoading(false);
              setWorkspaceScanLoading(false);
            }
          }
        }
      }
    } catch (err) {
      console.error("[IDE-APP] Error loading demo workspace via IPC:", err);
    }
  };

  // Startup Session Restoration
  useEffect(() => {
    if (!hasLoaded) return;
    if (isStateRestoredRef.current) return;
    isStateRestoredRef.current = true;

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("echo_recent_workspaces");
        if (stored) {
          setRecentWorkspaces(JSON.parse(stored));
        }
      } catch (e) {}
    }

    async function restoreSession() {
      if (loadedState && loadedState.folderPath) {
        console.log('[STATE] restored workspace', loadedState.folderPath);
        addLog(`[STATE] Restoring previous workspace session: ${loadedState.folderPath}`);

        // 1. Check if folder exists or is valid
        let folderValid = true;
        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.readDir) {
          try {
            const tree = await window.electronAPI.readDir(loadedState.folderPath);
            if (tree) {
              setFileTree(tree);
            } else {
              folderValid = false;
            }
          } catch (e) {
            folderValid = false;
          }
        }

        if (!folderValid) {
          console.warn("[STATE] Saved workspace path not found on disk, falling back to demo workspace.");
          await loadDemoWorkspace();
          return;
        }

        setFolderPath(loadedState.folderPath);
        saveRecentWorkspace(loadedState.folderPath);

        // 2. Restore panel dimensions & views
        if (loadedState.explorerWidth) setExplorerWidth(loadedState.explorerWidth);
        if (loadedState.analysisWidth) setAnalysisWidth(loadedState.analysisWidth);
        if (loadedState.consoleHeight) setConsoleHeight(loadedState.consoleHeight);
        if (loadedState.mainView) setMainView(loadedState.mainView);
        if (loadedState.editorStates) editorStatesRef.current = { ...loadedState.editorStates };

        // 3. Restore tabs
        const restoredTabs: TabItem[] = [];
        if (loadedState.openTabs && loadedState.openTabs.length > 0) {
          for (const tab of loadedState.openTabs) {
            try {
              if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.readFile) {
                const res = await window.electronAPI.readFile(tab.path);
                if (res.success && res.content !== undefined) {
                  restoredTabs.push({
                    path: tab.path,
                    name: tab.name || tab.path.split("/").pop() || "file",
                    content: res.content,
                    savedContent: res.content,
                    isDirty: false,
                  });
                }
              }
            } catch (tabErr) {
              console.warn("[STATE] Could not reopen file:", tab.path, tabErr);
            }
          }
        }

        if (restoredTabs.length > 0) {
          setOpenTabs(restoredTabs);
          console.log('[STATE] restored tabs', restoredTabs.length);
          addLog(`[STATE] Restored ${restoredTabs.length} tabs.`);

          const activePath = loadedState.activeTabPath && restoredTabs.some((t) => t.path === loadedState.activeTabPath)
            ? loadedState.activeTabPath
            : restoredTabs[0].path;

          setActiveTabPath(activePath);
          const activeTabObj = restoredTabs.find((t) => t.path === activePath) || restoredTabs[0];
          runAnalysis(activePath, activeTabObj.content);
        }

        // 4. Background workspace scan
        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanWorkspace) {
          setWorkspaceLoading(true);
          setWorkspaceScanLoading(true);
          try {
            const scanRes = await window.electronAPI.scanWorkspace(loadedState.folderPath);
            if (scanRes && !scanRes.error) {
              setWorkspaceSummary(scanRes);
              setWorkspaceReport(scanRes);
            }
          } catch (e) {
          } finally {
            setWorkspaceLoading(false);
            setWorkspaceScanLoading(false);
          }
        }

        if (loadedState.mainView === "graph") {
          handleLoadWorkspaceGraph(loadedState.folderPath);
        }

        return;
      }

      // Fresh session fallback
      await loadDemoWorkspace();
    }

    restoreSession();
  }, [hasLoaded, loadedState]);

  // Layout & focus editor on tab change or container resize
  useEffect(() => {
    console.log('[IDE-APP] useEffect: activeTabPath changed to', activeTabPath);
    if (editorRef.current) {
      try {
        console.log('[IDE-APP] triggering editor layout and focus');
        editorRef.current.layout();
        editorRef.current.focus();
      } catch (e) {}
    }
  }, [activeTabPath, explorerWidth, analysisWidth, consoleHeight]);

  // Window resize listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (editorRef.current) {
        try {
          editorRef.current.layout();
        } catch (e) {}
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log('[IDE-APP] useEffect: attaching keyboard shortcuts listener');
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isCmd && key === "s") {
        e.preventDefault();
        handleSaveFile();
      } else if (isCmd && key === "w") {
        e.preventDefault();
        if (activeTab) handleCloseTab(activeTab.path);
      } else if (isCmd && key === "p") {
        e.preventDefault();
        setQuickOpenOpen(true);
      } else if (isCmd && key === "k") {
        e.preventDefault();
        setCmdPaletteOpen(true);
      } else if (e.key === "F5") {
        e.preventDefault();
        if (activeTabPath) runAnalysis(activeTabPath, activeTab.content);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabPath, openTabs, activeTab]);

  // Apply Monaco Line Highlights
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    try {
      console.log('[IDE-APP] useEffect: updating line decorations for', findings.length, 'findings');
      const editor = editorRef.current;
      const newDecorations = findings.map((f) => ({
        range: {
          startLineNumber: f.line,
          startColumn: 1,
          endLineNumber: f.line,
          endColumn: 100,
        },
        options: {
          isWholeLine: true,
          className: "ghost-code-line-bg",
          inlineClassName: "ghost-code-line-text",
          glyphMarginClassName: "ghost-code-glyph",
          linesDecorationsClassName: "ghost-code-line-decoration",
          hoverMessage: {
            value: `**${f.title}** (Causal Luminance: 0.00)\n\n${f.reason}`,
          },
        },
      }));

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    } catch (err) {
      console.error("[IDE-APP] Error applying line decorations:", err);
    }
  }, [findings, activeTabPath, activeTab?.content]);

  // Open Recent Workspace Handler
  const handleOpenRecentWorkspace = async (targetFolder: string) => {
    if (typeof window === "undefined" || !window.electronAPI) return;
    try {
      addLog(`[IPC] Opening recent workspace: ${targetFolder}`);
      const dirRes = await window.electronAPI.readDir(targetFolder);
      if (dirRes && dirRes.tree) {
        setFolderPath(targetFolder);
        setFileTree(dirRes.tree);
        saveRecentWorkspace(targetFolder);

        // Auto trigger workspace scan
        console.log('[WORKSPACE] scan start', targetFolder);
        setWorkspaceLoading(true);
        setWorkspaceScanLoading(true);
        try {
          const scanRes = await window.electronAPI.scanWorkspace(targetFolder);
          if (scanRes && !scanRes.error) {
            setWorkspaceSummary(scanRes);
            setWorkspaceReport(scanRes);
            console.log('[WORKSPACE] scan complete', scanRes);
            if (scanRes.files.length > 0) {
              handleOpenWorkspaceFile(scanRes.files[0]);
            }
          }
        } catch (scanErr) {
          console.error('[WORKSPACE] scan error:', scanErr);
        } finally {
          setWorkspaceLoading(false);
          setWorkspaceScanLoading(false);
        }
      }
    } catch (e) {
      console.error("[IDE-APP] Error opening recent workspace:", e);
    }
  };

  // Open Folder Handler
  const handleOpenFolder = async () => {
    if (typeof window === "undefined" || !window.electronAPI) {
      addLog("[WARN] Running in web mode. Folder dialog requires Electron desktop app.");
      return;
    }

    try {
      addLog("[IPC] Invoking dialog:open-folder...");
      const res = await window.electronAPI.openFolder();
      if (res && res.tree) {
        setFolderPath(res.folderPath);
        setFileTree(res.tree);
        saveRecentWorkspace(res.folderPath);
        addLog(`[IPC] Opened directory: ${res.folderPath}`);

        // Automatically trigger workspace scan
        console.log('[WORKSPACE] scan start', res.folderPath);
        setWorkspaceLoading(true);
        setWorkspaceScanLoading(true);
        try {
          const scanRes = await window.electronAPI.scanWorkspace(res.folderPath);
          if (scanRes && !scanRes.error) {
            setWorkspaceSummary(scanRes);
            setWorkspaceReport(scanRes);
            console.log('[WORKSPACE] scan complete', scanRes);
            addLog(`[WORKSPACE] Scan complete: ${scanRes.files_scanned} files analyzed.`);
          }
        } catch (scanErr) {
          console.error('[WORKSPACE] scan error:', scanErr);
        } finally {
          setWorkspaceLoading(false);
          setWorkspaceScanLoading(false);
        }
      }
    } catch (err) {
      console.error("[IDE-APP] Error in openFolder:", err);
    }
  };

  // Open File Handler
  const handleOpenFile = async (file: FileNode) => {
    if (file.isDirectory) return;

    if (activeTabPath && editorRef.current) {
      try {
        const pos = editorRef.current.getPosition();
        if (pos) {
          setCursorPositions((prev) => ({
            ...prev,
            [activeTabPath]: { line: pos.lineNumber, col: pos.column },
          }));
        }
      } catch (e) {}
    }

    const existing = openTabs.find((t) => t.path === file.path);
    if (existing) {
      setActiveTabPath(file.path);
      restoreTabCursor(file.path);
      runAnalysis(file.path, existing.content);
      return;
    }

    addLog(`[FS] Reading file from disk: ${file.name}`);
    let content = defaultCartCalculatorCode;
    if (typeof window !== "undefined" && window.electronAPI && !file.path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] handleOpenFile invoking readFile for', file.path);
        const res = await window.electronAPI.readFile(file.path);
        if (res.success && res.content !== undefined) {
          content = res.content;
        } else if (res.error) {
          addLog(`[ERROR] Failed to read file: ${res.error}`);
          return;
        }
      } catch (err) {
        console.error("[IDE-APP] Error reading file:", err);
      }
    }

    const newTab: TabItem = {
      path: file.path,
      name: file.name,
      content,
      savedContent: content,
      isDirty: false,
    };
    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabPath(file.path);
    restoreTabCursor(file.path);
    runAnalysis(file.path, content);
  };

  const restoreTabCursor = (path: string) => {
    setTimeout(() => {
      try {
        const savedPos = editorStatesRef.current[path] || (cursorPositions[path] ? {
          cursorLine: cursorPositions[path].line,
          cursorColumn: cursorPositions[path].col,
          scrollTop: 0,
          scrollLeft: 0,
        } : null);

        if (savedPos && editorRef.current) {
          editorRef.current.setPosition({ lineNumber: savedPos.cursorLine, column: savedPos.cursorColumn });
          if (savedPos.scrollTop !== undefined) {
            editorRef.current.setScrollTop(savedPos.scrollTop);
          }
          if (savedPos.scrollLeft !== undefined) {
            editorRef.current.setScrollLeft(savedPos.scrollLeft);
          }
          editorRef.current.revealPositionInCenter({ lineNumber: savedPos.cursorLine, column: savedPos.cursorColumn });
          editorRef.current.focus();
        }
      } catch (e) {}
    }, 50);
  };

  useEffect(() => {
    if (findings.length > 0) {
      setSelectedFinding((prev) => {
        if (prev && findings.some((f) => f.line === prev.line)) {
          return findings.find((f) => f.line === prev.line) || findings[0];
        }
        return findings[0];
      });
    } else {
      setSelectedFinding(null);
    }
  }, [findings]);

  const handleFindingClick = (finding: Finding) => {
    setSelectedFinding(finding);
    if (!editorRef.current) return;
    try {
      const editor = editorRef.current;
      editor.focus();
      editor.revealLineInCenter(finding.line);
      editor.setPosition({ lineNumber: finding.line, column: 1 });
      addLog(`[NAV] Jumped to Line ${finding.line}: ${finding.title}`);
    } catch (err) {
      console.error("[IDE-APP] Error focusing finding line:", err);
    }
  };

  const handleProvenanceStepClick = (line: number, code: string) => {
    if (!editorRef.current) return;
    try {
      const editor = editorRef.current;
      editor.focus();
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      addLog(`[PROVENANCE] Replay focus -> Line ${line}: ${code}`);
    } catch (err) {
      console.error("[IDE-APP] Error focusing provenance line:", err);
    }
  };

  const handleEditorChange = (newVal: string | undefined) => {
    const val = newVal || "";
    setOpenTabs((prev) =>
      prev.map((t) => {
        if (t.path === activeTabPath) {
          const isDirty = val !== t.savedContent;
          return { ...t, content: val, isDirty };
        }
        return t;
      })
    );
  };

  const handleCloseTab = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tabToClose = openTabs.find((t) => t.path === path);
    if (tabToClose?.isDirty) {
      setCloseConfirmTab(tabToClose);
      return;
    }

    executeCloseTab(path);
  };

  const executeCloseTab = (path: string) => {
    const newTabs = openTabs.filter((t) => t.path !== path);
    setOpenTabs(newTabs);

    if (activeTabPath === path && newTabs.length > 0) {
      const nextTab = newTabs[newTabs.length - 1];
      setActiveTabPath(nextTab.path);
      runAnalysis(nextTab.path, nextTab.content);
    }
  };

  const handleSaveFile = async () => {
    if (!activeTab) return;
    addLog(`[FS] Saving file: ${activeTab.name}`);

    if (typeof window !== "undefined" && window.electronAPI && !activeTab.path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] handleSaveFile invoking writeFile for', activeTab.path);
        const res = await window.electronAPI.writeFile(activeTab.path, activeTab.content);
        if (res.success) {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === activeTab.path
                ? { ...t, savedContent: t.content, isDirty: false }
                : t
            )
          );
          showToast(`Saved ${activeTab.name}`);
          addLog(`[FS] File saved successfully to disk.`);
        } else {
          addLog(`[ERROR] Save failed: ${res.error}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error saving file:", err);
      }
    } else {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, savedContent: t.content, isDirty: false }
            : t
        )
      );
      showToast(`Saved ${activeTab.name}`);
      addLog(`[FS] Saved ${activeTab.name} (Mock).`);
    }
  };

  const runAnalysis = async (path: string, content: string) => {
    setAnalyzing(true);
    addLog(`[ENGINE] Running Python analyzer on ${path}...`);

    if (typeof window !== "undefined" && window.electronAPI && !path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] runAnalysis invoking analyzeFile for', path);
        const res = await window.electronAPI.analyzeFile(path);
        if (res && res.findings) {
          setFindings(res.findings);
          setLuminance(res.causal_luminance !== undefined ? res.causal_luminance : (res.findings.length > 0 ? 0.0 : 1.0));
          addLog(`[ENGINE] Analysis complete: ${res.findings.length} ghost lines detected.`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error running AST analysis:", err);
      }
    } else {
      const lines = content.split("\n");
      const clientFindings: Finding[] = [];
      lines.forEach((l, i) => {
        if (/(\*\s*1|\+\s*0|-\s*0|\/\s*1)/.test(l)) {
          clientFindings.push({
            line: i + 1,
            code: l.trim(),
            title: "Identity Operation",
            reason: "Mathematical identity operation detected.",
            luminance: 0.0,
            status: "Verified Ghost Line",
          });
        }
      });
      setFindings(clientFindings);
      setLuminance(clientFindings.length > 0 ? 0.0 : 1.0);
      addLog(`[ENGINE] Analysis complete: ${clientFindings.length} ghost lines detected.`);
    }
    setAnalyzing(false);
  };

  const handleRunWorkspaceScan = async () => {
    if (!folderPath) return;

    setWorkspaceLoading(true);
    setWorkspaceScanLoading(true);
    console.log('[WORKSPACE] scan start', folderPath);
    addLog(`[SCAN] Starting workspace-wide AST tomography on ${folderPath}...`);

    if (typeof window !== "undefined" && window.electronAPI && !folderPath.startsWith("demo-workspaces/")) {
      try {
        const report = await window.electronAPI.scanWorkspace(folderPath);
        if (report && !report.error) {
          setWorkspaceSummary(report);
          setWorkspaceReport(report);
          console.log('[WORKSPACE] scan complete', report);
          setRightPanelTab("project");
          showToast(`Scanned ${report.files_scanned} files (${report.total_ghost_lines} ghost lines)`);
          addLog(`[SCAN] Project scan complete: ${report.files_scanned} files, ${report.total_ghost_lines} ghost lines (ratio: ${(report.ghost_ratio * 100).toFixed(1)}%).`);
        } else {
          addLog(`[ERROR] Workspace scan failed: ${report?.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error running workspace scan:", err);
        addLog(`[ERROR] Scan exception: ${err}`);
      }
    } else {
      // Demo workspace scan fallback
      const demoReport: WorkspaceReport = {
        workspace: folderPath,
        files_scanned: 3,
        total_ghost_lines: 4,
        total_lines: 52,
        ghost_ratio: 0.0769,
        average_causal_luminance: 0.67,
        risky_files_count: 1,
        safe_removals_count: 4,
        scan_duration_ms: 10.5,
        files: [
          {
            path: "src/cart_calculator.py",
            absolute_path: "demo-workspaces/ai_cart_project/src/cart_calculator.py",
            ghost_lines: 4,
            total_lines: 24,
            ghost_ratio: 0.1667,
            causal_luminance: 0.0,
            findings: findings,
          },
          {
            path: "src/checkout_engine.py",
            absolute_path: "demo-workspaces/ai_cart_project/src/checkout_engine.py",
            ghost_lines: 0,
            total_lines: 16,
            ghost_ratio: 0.0,
            causal_luminance: 1.0,
            findings: [],
          },
          {
            path: "src/invoice_processor.py",
            absolute_path: "demo-workspaces/ai_cart_project/src/invoice_processor.py",
            ghost_lines: 0,
            total_lines: 12,
            ghost_ratio: 0.0,
            causal_luminance: 1.0,
            findings: [],
          },
        ],
      };
      setWorkspaceSummary(demoReport);
      setWorkspaceReport(demoReport);
      console.log('[WORKSPACE] scan complete', demoReport);
      setRightPanelTab("project");
      showToast(`Scanned 3 files (4 ghost lines)`);
      addLog(`[SCAN] Project scan complete: 3 files, 4 ghost lines.`);
    }

    setWorkspaceLoading(false);
    setWorkspaceScanLoading(false);
  };

  const handleOpenWorkspaceFile = async (fileReport: WorkspaceFileReport) => {
    const targetPath = fileReport.absolute_path || (folderPath ? `${folderPath}/${fileReport.path}` : fileReport.path);
    const fileName = fileReport.path.split("/").pop() || fileReport.path;

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    if (fileReport.findings && fileReport.findings.length > 0) {
      setTimeout(() => {
        handleFindingClick(fileReport.findings[0]);
      }, 100);
    }
  };

  const handleExportReport = async () => {
    if (!folderPath) return;

    addLog(`[EXPORT] Generating workspace report for ${folderPath}...`);

    const graphSvg = exportGraphSvg(workspaceGraph);

    const metrics = {
      files_scanned: workspaceSummary?.files_scanned || (fileTree ? 3 : 1),
      total_ghost_lines: workspaceSummary?.total_ghost_lines || findings.length,
      total_lines: workspaceSummary?.total_lines || 45,
      ghost_ratio: workspaceSummary?.ghost_ratio || (findings.length > 0 ? findings.length / 45 : 0),
      average_causal_luminance: workspaceSummary?.average_causal_luminance || luminance,
      risky_files_count: workspaceSummary?.risky_files_count || (findings.length > 0 ? 1 : 0),
      safe_removals_count: workspaceSummary?.safe_removals_count || findings.length,
      scan_duration_ms: workspaceSummary?.scan_duration_ms || 32.5,
    };

    const payload: ReportExportPayload = {
      workspacePath: folderPath,
      timestamp: new Date().toLocaleString(),
      metrics,
      findings: findings.map((f) => ({
        file: (f as any).file || (activeTab ? activeTab.name : "cart_calculator.py"),
        line: f.line,
        type: f.category || f.status,
        title: f.title,
        code: f.code,
        description: f.reason || f.title,
        causal_impact: (1.0 - (f.luminance ?? 0)) * 100,
        causal_path_length: f.causal_path_length,
        return_sink_line: f.return_sink_line,
        provenance_chain: f.provenance_chain,
      })),
      graphSvg,
      activeFinding: selectedFinding ? {
        file: (selectedFinding as any).file || (activeTab ? activeTab.name : "cart_calculator.py"),
        line: selectedFinding.line,
        type: selectedFinding.category || selectedFinding.status,
        title: selectedFinding.title,
        code: selectedFinding.code,
        description: selectedFinding.reason || selectedFinding.title,
        causal_impact: (1.0 - (selectedFinding.luminance ?? 0)) * 100,
        causal_path_length: selectedFinding.causal_path_length,
        return_sink_line: selectedFinding.return_sink_line,
        provenance_chain: selectedFinding.provenance_chain,
      } : null,
    };

    const htmlContent = buildWorkspaceReport(payload);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.exportWorkspaceReport) {
      try {
        const res = await window.electronAPI.exportWorkspaceReport({
          workspacePath: folderPath,
          htmlContent,
          findingsJson: payload.findings,
          graphSvg,
        });

        if (res && res.success) {
          const dirName = res.path.split("/").pop() || "Report";
          showToast(`Report exported · ${dirName}`);
          addLog(`[EXPORT] Report written to: ${res.path}`);
          console.log('[EXPORT] Report written to', res.path);
        } else {
          addLog(`[ERROR] Export failed: ${res?.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error exporting report:", err);
      }
    } else {
      showToast(`Report exported (Mock)`);
      console.log('[EXPORT] Report written to (mock)', folderPath);
    }
  };

  const handleLoadWorkspaceGraph = async (targetFolder?: string) => {
    const folder = targetFolder || folderPath;
    if (!folder) return;

    setGraphLoading(true);
    console.log('[GRAPH] build start', folder);
    addLog(`[GRAPH] Building cross-file provenance graph for ${folder}...`);

    if (typeof window !== "undefined" && window.electronAPI && !folder.startsWith("demo-workspaces/")) {
      try {
        const graphData = await window.electronAPI.buildWorkspaceGraph(folder);
        if (graphData && !graphData.error) {
          setWorkspaceGraph(graphData);
          console.log('[GRAPH] build complete', graphData.nodes?.length || 0, graphData.edges?.length || 0);
          addLog(`[GRAPH] Graph generated: ${graphData.nodes?.length || 0} nodes, ${graphData.edges?.length || 0} edges.`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error building workspace graph:", err);
      }
    } else {
      // Demo workspace graph fallback
      const demoGraph: WorkspaceGraph = {
        workspace: folder,
        nodes: [
          { id: "src/cart_calculator.py::L6::subtotal::definition", file: "src/cart_calculator.py", symbol: "subtotal", line: 6, kind: "definition", code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)", label: "subtotal (L6)" },
          { id: "src/cart_calculator.py::L9::subtotal::ghost_operation", file: "src/cart_calculator.py", symbol: "subtotal", line: 9, kind: "ghost_operation", code: "subtotal = subtotal * 1", label: "subtotal (L9)" },
          { id: "src/cart_calculator.py::L10::subtotal::ghost_operation", file: "src/cart_calculator.py", symbol: "subtotal", line: 10, kind: "ghost_operation", code: "subtotal = subtotal + 0", label: "subtotal (L10)" },
          { id: "src/cart_calculator.py::L11::subtotal::ghost_operation", file: "src/cart_calculator.py", symbol: "subtotal", line: 11, kind: "ghost_operation", code: "subtotal = subtotal - 0", label: "subtotal (L11)" },
          { id: "src/cart_calculator.py::L12::subtotal::ghost_operation", file: "src/cart_calculator.py", symbol: "subtotal", line: 12, kind: "ghost_operation", code: "subtotal = subtotal / 1", label: "subtotal (L12)" },
          { id: "src/cart_calculator.py::L16::discount_amount::use", file: "src/cart_calculator.py", symbol: "discount_amount", line: 16, kind: "use", code: "discount_amount = subtotal * 0.10", label: "discount_amount (L16)" },
          { id: "src/cart_calculator.py::L20::taxable_amount::use", file: "src/cart_calculator.py", symbol: "taxable_amount", line: 20, kind: "use", code: "taxable_amount = max(0.0, subtotal - discount_amount)", label: "taxable_amount (L20)" },
          { id: "src/cart_calculator.py::L24::return", file: "src/cart_calculator.py", symbol: "return", line: 24, kind: "return_sink", code: "return round(final_total, 2)", label: "return (L24)" },
          { id: "src/checkout_engine.py::process_checkout", file: "src/checkout_engine.py", symbol: "process_checkout", line: 1, kind: "definition", code: "def process_checkout():", label: "def process_checkout()" },
          { id: "src/invoice_processor.py::generate_invoice_pdf", file: "src/invoice_processor.py", symbol: "generate_invoice_pdf", line: 1, kind: "definition", code: "def generate_invoice_pdf():", label: "def generate_invoice_pdf()" }
        ],
        edges: [
          { source: "src/cart_calculator.py::L6::subtotal::definition", target: "src/cart_calculator.py::L9::subtotal::ghost_operation", type: "ghost_flow" },
          { source: "src/cart_calculator.py::L9::subtotal::ghost_operation", target: "src/cart_calculator.py::L16::discount_amount::use", type: "data_flow" },
          { source: "src/cart_calculator.py::L16::discount_amount::use", target: "src/cart_calculator.py::L20::taxable_amount::use", type: "data_flow" },
          { source: "src/cart_calculator.py::L20::taxable_amount::use", target: "src/cart_calculator.py::L24::return", type: "data_flow" }
        ]
      };
      setWorkspaceGraph(demoGraph);
      console.log('[GRAPH] build complete', demoGraph.nodes.length, demoGraph.edges.length);
      addLog(`[GRAPH] Graph generated: ${demoGraph.nodes.length} nodes, ${demoGraph.edges.length} edges.`);
    }

    setGraphLoading(false);
  };

  const handleGraphNodeClick = async (node: GraphNode) => {
    console.log('[GRAPH] node clicked', node.id);
    addLog(`[GRAPH] Navigating to node ${node.symbol} (line ${node.line}) in ${node.file}...`);

    const targetPath = folderPath ? `${folderPath}/${node.file}` : node.file;
    const fileName = node.file.split("/").pop() || node.file;

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setMainView("editor");

    setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.revealLineInCenter(node.line);
          editorRef.current.setPosition({ lineNumber: node.line, column: 1 });
          editorRef.current.focus();
        } catch (e) {}
      }
    }, 150);
  };

  const runDifferentialVerification = async (filePath: string, transformedContent: string) => {
    setVerifying(true);
    addLog(`[VERIFY] Running isolated differential verification for ${filePath}...`);

    if (typeof window !== "undefined" && window.electronAPI && !filePath.startsWith("demo-workspaces/")) {
      try {
        const res = await window.electronAPI.verifyEquivalence(filePath, transformedContent);
        setVerificationResult(res);
        if (res && res.verified) {
          addLog(`[VERIFY] Behavioral equivalence confirmed! (Original: ${res.original?.duration_ms}ms, Transformed: ${res.transformed?.duration_ms}ms, Delta: ${res.delta_ms}ms)`);
        } else {
          addLog(`[WARN] Verification status: ${res?.status || "DIVERGENCE_DETECTED"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error running verification:", err);
        setVerificationResult({
          verified: false,
          status: "VERIFICATION_FAILED",
          original: null,
          transformed: null,
          delta_ms: 0,
          outputs_match: false,
          error: String(err),
        });
      }
    } else {
      await new Promise((r) => setTimeout(r, 300));
      const mockResult: VerificationResult = {
        verified: true,
        status: "BEHAVIORAL_EQUIVALENCE_CONFIRMED",
        original: {
          exit_code: 0,
          stdout: "",
          stderr: "",
          duration_ms: 22.4,
        },
        transformed: {
          exit_code: 0,
          stdout: "",
          stderr: "",
          duration_ms: 21.8,
        },
        delta_ms: -0.6,
        outputs_match: true,
      };
      setVerificationResult(mockResult);
      addLog(`[VERIFY] Behavioral equivalence confirmed.`);
    }

    setVerifying(false);
  };

  const handleOpenDiffPreview = async () => {
    if (!activeTab || findings.length === 0) return;

    addLog(`[SURGERY] Calling engine:preview-safe-remove for ${activeTab.name}...`);

    if (typeof window !== "undefined" && window.electronAPI && !activeTab.path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] handleOpenDiffPreview invoking previewSafeRemove for', activeTab.path);
        const preview = await window.electronAPI.previewSafeRemove(activeTab.path);
        if (preview && preview.transformed_source !== undefined) {
          setDiffData(preview);
          setDiffDrawerOpen(true);
          runDifferentialVerification(activeTab.path, preview.transformed_source);
        }
      } catch (err) {
        console.error("[IDE-APP] Error generating safe remove preview:", err);
      }
    } else {
      const lines = activeTab.content.split("\n");
      const changedLines: number[] = [];
      const transformedLines = lines.map((l, idx) => {
        if (/(\*\s*1|\+\s*0|-\s*0|\/\s*1)/.test(l)) {
          changedLines.push(idx + 1);
          return l.replace(/\*\s*1|\+\s*0|-\s*0|\/\s*1/g, "").trimEnd();
        }
        return l;
      });

      const transformedCode = transformedLines.join("\n");
      setDiffData({
        file: activeTab.path,
        original_source: activeTab.content,
        transformed_source: transformedCode,
        changed_lines: changedLines,
        ghost_count_before: findings.length,
        ghost_count_after: 0,
        causal_luminance_after: 1.0,
      });
      setDiffDrawerOpen(true);
      runDifferentialVerification(activeTab.path, transformedCode);
    }
  };

  const handleApplySafeRemove = async () => {
    if (!activeTab || !diffData) return;

    const ghostRemoved = diffData.ghost_count_before;
    addLog(`[SURGERY] Executing engine:apply-safe-remove on ${activeTab.name}...`);

    if (typeof window !== "undefined" && window.electronAPI && !activeTab.path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] handleApplySafeRemove invoking applySafeRemove for', activeTab.path);
        const res = await window.electronAPI.applySafeRemove(activeTab.path, diffData.transformed_source);
        if (res.success) {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === activeTab.path
                ? { ...t, content: res.transformedContent, savedContent: res.transformedContent, isDirty: false }
                : t
            )
          );
          setFindings([]);
          setLuminance(1.0);
          setDiffDrawerOpen(false);
          showToast(`Surgery complete · ${ghostRemoved} ghost lines removed.`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error applying safe remove surgery:", err);
      }
    } else {
      const updated = diffData.transformed_source;
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, content: updated, savedContent: updated, isDirty: false }
            : t
        )
      );
      setFindings([]);
      setLuminance(1.0);
      setDiffDrawerOpen(false);
      showToast(`Surgery complete · ${ghostRemoved} ghost lines removed.`);
    }
  };

  const handleRestoreBackup = async () => {
    if (!activeTab) return;
    addLog(`[RESTORE] Restoring latest .bak snapshot for ${activeTab.name}...`);

    if (typeof window !== "undefined" && window.electronAPI && !activeTab.path.startsWith("demo-workspaces/")) {
      try {
        console.log('[IDE-APP] handleRestoreBackup invoking restoreBackup for', activeTab.path);
        const res = await window.electronAPI.restoreBackup(activeTab.path);
        if (res.success && res.restoredContent) {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === activeTab.path
                ? { ...t, content: res.restoredContent, savedContent: res.restoredContent, isDirty: false }
                : t
            )
          );
          runAnalysis(activeTab.path, res.restoredContent);
          showToast(`Backup restored`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error restoring backup:", err);
      }
    } else {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, content: defaultCartCalculatorCode, savedContent: defaultCartCalculatorCode, isDirty: false }
            : t
        )
      );
      runAnalysis(activeTab.path, defaultCartCalculatorCode);
      showToast(`Backup restored`);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    console.log('[MONACO] mounted');
    editorRef.current = editor;
    monacoRef.current = monaco;

    setTimeout(() => {
      try {
        console.log('[MONACO] invoking editor.layout() and focus()');
        editor.layout();
        editor.focus();
        const node = editor.getContainerDomNode();
        console.log('[MONACO-SIZE-AFTER-LAYOUT]', node?.clientWidth, node?.clientHeight);
        console.log('[MONACO-PARENT-SIZE-AFTER-LAYOUT]', node?.parentElement?.clientWidth, node?.parentElement?.clientHeight);
      } catch (e) {}
    }, 150);

    try {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSaveFile();
      });

      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPos({ line: e.position.lineNumber, col: e.position.column });
        if (activeTabPath) {
          editorStatesRef.current[activeTabPath] = {
            cursorLine: e.position.lineNumber,
            cursorColumn: e.position.column,
            scrollTop: editor.getScrollTop ? editor.getScrollTop() : 0,
            scrollLeft: editor.getScrollLeft ? editor.getScrollLeft() : 0,
          };
          triggerAutoSave();
        }
      });

      editor.onDidScrollChange((e: any) => {
        if (activeTabPath) {
          const pos = editor.getPosition();
          editorStatesRef.current[activeTabPath] = {
            cursorLine: pos ? pos.lineNumber : 1,
            cursorColumn: pos ? pos.column : 1,
            scrollTop: e.scrollTop !== undefined ? e.scrollTop : editor.getScrollTop(),
            scrollLeft: e.scrollLeft !== undefined ? e.scrollLeft : editor.getScrollLeft(),
          };
          triggerAutoSave();
        }
      });

      // Restore saved view state if available
      if (activeTabPath && editorStatesRef.current[activeTabPath]) {
        const saved = editorStatesRef.current[activeTabPath];
        setTimeout(() => {
          try {
            editor.setPosition({ lineNumber: saved.cursorLine, column: saved.cursorColumn });
            if (saved.scrollTop !== undefined) editor.setScrollTop(saved.scrollTop);
            if (saved.scrollLeft !== undefined) editor.setScrollLeft(saved.scrollLeft);
            editor.revealPositionInCenter({ lineNumber: saved.cursorLine, column: saved.cursorColumn });
          } catch (e) {}
        }, 50);
      }
      
      monaco.editor.defineTheme("echo-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "keyword", foreground: "8b5cf6", fontStyle: "bold" },
          { token: "identifier", foreground: "22d3ee" },
          { token: "string", foreground: "10b981" },
          { token: "comment", foreground: "6b7280", fontStyle: "italic" },
        ],
        colors: {
          "editor.background": "#050505",
          "editor.foreground": "#e5e7eb",
          "editorLineNumber.foreground": "#4b5563",
          "editorLineNumber.activeForeground": "#22d3ee",
          "editor.lineHighlightBackground": "#0d0d0d",
          "editorGutter.background": "#050505",
        },
      });
      monaco.editor.setTheme("echo-dark");
    } catch (err) {
      console.error("[MONACO] Error setting up Monaco theme/events:", err);
    }
  };

  const startExplorerResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = explorerWidth;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const newW = Math.max(160, Math.min(400, startW + (moveEvt.clientX - startX)));
      setExplorerWidth(newW);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const startAnalysisResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = analysisWidth;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const newW = Math.max(200, Math.min(450, startW - (moveEvt.clientX - startX)));
      setAnalysisWidth(newW);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const startConsoleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = consoleHeight;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const newH = Math.max(60, Math.min(300, startH - (moveEvt.clientY - startY)));
      setConsoleHeight(newH);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const renderTree = (node: FileNode, level = 0) => {
    const isExp = expandedFolders[node.path];
    return (
      <div key={node.path} style={{ paddingLeft: `${level * 10}px` }}>
        {node.isDirectory ? (
          <div>
            <button
              onClick={() => toggleFolder(node.path)}
              className="w-full py-1 px-2 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/60 rounded font-mono text-left"
            >
              {isExp ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
              <span className="font-semibold text-zinc-300">{node.name}</span>
            </button>
            {isExp && node.children && (
              <div>{node.children.map((child) => renderTree(child, level + 1))}</div>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleOpenFile(node)}
            className={`w-full py-1 px-2 flex items-center gap-1.5 text-xs font-mono text-left rounded transition-colors ${
              activeTabPath === node.path
                ? "bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 font-bold"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
      </div>
    );
  };

  const fileList = fileTree ? extractFileList(fileTree) : [];

  if (typeof window !== "undefined") {
    console.log(`[P-METRICS] window=${window.innerWidth} root=${rootRef.current?.clientWidth} row=${contentRowRef.current?.clientWidth} exp=${explorerPanelRef.current?.clientWidth} edit=${editorPaneRef.current?.clientWidth} ana=${analysisPanelRef.current?.clientWidth} mon=${monacoWrapperRef.current?.clientWidth}`);
  }

  return (
    <div ref={rootRef} style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }} className="flex flex-col h-screen w-screen bg-[#050505] text-white font-sans overflow-hidden select-none relative">
      
      {/* Animated Top Edge Cyan Scanline */}
      <div className="top-scanline" />

      {/* 1. Header Navigation Bar */}
      <header className="h-12 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-4 text-xs font-mono shrink-0 z-20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-heading font-bold text-sm text-white tracking-tight">
              Echo Nullity IDE
            </span>
            <span className="px-2 py-0.5 text-[9px] text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 rounded-full font-bold">
              DEMO WORKSPACE
            </span>
          </div>

          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-200 transition-all shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Folder</span>
          </button>

          <button
            onClick={handleSaveFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-200 transition-all"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save (⌘S)</span>
          </button>

          <button
            onClick={() => setMainView(mainView === "dashboard" ? "editor" : "dashboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
              mainView === "dashboard"
                ? "bg-purple-950 text-purple-300 border-purple-500/50 shadow-purple-glow font-bold"
                : "bg-[#141414] hover:bg-[#1f1f1f] border-[#262626] text-zinc-300"
            }`}
            title="Toggle Workspace Tomography Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              const next = mainView === "graph" ? "editor" : "graph";
              setMainView(next);
              if (next === "graph" && !workspaceGraph) {
                handleLoadWorkspaceGraph();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
              mainView === "graph"
                ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-cyan-glow font-bold"
                : "bg-[#141414] hover:bg-[#1f1f1f] border-[#262626] text-zinc-300"
            }`}
            title="Toggle Cross-File Provenance Graph"
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>Graph</span>
          </button>

          <button
            onClick={() => setStartupModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-400 hover:text-white transition-all"
            title="Open Workspace Hub / Recent Projects"
          >
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Hub</span>
          </button>

          <button
            onClick={() => setQuickOpenOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-purple-300 transition-all"
          >
            <Search className="w-3.5 h-3.5 text-purple-400" />
            <span>Quick Open (⌘P)</span>
          </button>

          <button
            onClick={() => setCmdPaletteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-cyan-300 transition-all"
          >
            <Command className="w-3.5 h-3.5 text-cyan-400" />
            <span>Palette (⌘K)</span>
          </button>

          {saveStatus && (
            <span className="flex items-center gap-1 text-emerald-400 font-bold animate-fade-in bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" />
              <span>{saveStatus}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] hover:border-emerald-500/40 text-zinc-300 hover:text-white transition-all shadow-sm"
            title="Export complete standalone HTML, JSON, and SVG workspace report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Report</span>
          </button>

          <button
            onClick={handleRunWorkspaceScan}
            disabled={workspaceScanLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-cyan-500/40 text-cyan-300 font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {workspaceScanLoading ? (
              <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{workspaceScanLoading ? "Scanning workspace..." : "Run Workspace Scan"}</span>
          </button>

          <button
            onClick={() => activeTabPath && runAnalysis(activeTabPath, activeTab.content)}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/40 text-purple-300 font-bold transition-all shadow-purple-glow"
          >
            <Play className="w-3.5 h-3.5 fill-purple-400" />
            <span>{analyzing ? "Analyzing AST..." : "Run Tomography (F5)"}</span>
          </button>

          <button
            onClick={handleOpenDiffPreview}
            disabled={findings.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 fill-black" />
            <span>Safe Remove Surgery ({findings.length})</span>
          </button>
        </div>
      </header>

      {/* 2. Main Resizable Workspace Grid */}
      <div ref={contentRowRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", overflow: "hidden" }} className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
        
        {/* Left Sidebar: File Explorer */}
        {showExplorer && (
          <div ref={explorerPanelRef} style={{ width: `${explorerWidth}px`, flexShrink: 0 }} className="bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col justify-between shrink-0 select-none">
            <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-400 uppercase tracking-widest font-bold text-[10px]">Explorer</span>
              <span className="text-cyan-400 text-[10px]">Tree-sitter</span>
            </div>

            <div className="flex-1 p-2 overflow-y-auto space-y-1">
              {fileTree && renderTree(fileTree)}
            </div>

            <div className="p-3 bg-[#0d0d0d] border-t border-[#1f1f1f] font-mono text-[10px] text-zinc-500 flex items-center justify-between">
              <span>Python AST Rules Active</span>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        )}

        {/* Resizer col 1 */}
        {showExplorer && (
          <div onMouseDown={startExplorerResize} className="resizer-col" />
        )}

        {/* Center Pane: Multi-Tab Monaco Editor, Workspace Dashboard, or Workspace Graph */}
        <div ref={editorPaneRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }} className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#050505]">
          
          {mainView === "dashboard" ? (
            <WorkspaceDashboard
              summary={workspaceSummary || workspaceReport}
              loading={workspaceLoading || workspaceScanLoading}
              onRescan={handleRunWorkspaceScan}
              onOpenFile={(file) => {
                handleOpenWorkspaceFile(file);
                setMainView("editor");
              }}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "graph" ? (
            <WorkspaceGraphPanel
              graph={workspaceGraph}
              loading={graphLoading}
              onRefresh={() => handleLoadWorkspaceGraph()}
              onNodeClick={handleGraphNodeClick}
              onClose={() => setMainView("editor")}
            />
          ) : (
            <>
              {/* Multi-Tab Bar */}
              <div className="h-9 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center px-2 gap-1 font-mono text-xs overflow-x-auto shrink-0">
                {openTabs.map((tab) => (
                  <div
                    key={tab.path}
                    onClick={() => {
                      setActiveTabPath(tab.path);
                      restoreTabCursor(tab.path);
                      runAnalysis(tab.path, tab.content);
                    }}
                    className={`group px-3 py-1 rounded-t-lg flex items-center gap-2 cursor-pointer transition-all ${
                      activeTabPath === tab.path
                        ? "bg-[#050505] text-cyan-400 border-t border-x border-cyan-500/40 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{tab.name}</span>

                    {tab.isDirty && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Unsaved changes ●" />
                    )}

                    <button
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Monaco Editor Container */}
              <div ref={monacoWrapperRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative", overflow: "hidden" }} className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-[#050505]">
                {activeTab ? (
                  <MonacoEditor
                    key={activeTab.path}
                    width="100%"
                    height="100%"
                    language={getLanguageFromPath(activeTab.path)}
                    value={activeTab.content ?? ""}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 13,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      lineNumbers: "on",
                      minimap: { enabled: true },
                      bracketPairColorization: { enabled: true },
                      "semanticHighlighting.enabled": true,
                      wordWrap: "off",
                      smoothScrolling: true,
                      automaticLayout: true,
                      padding: { top: 12 },
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#050505] text-zinc-500 flex items-center justify-center font-mono text-xs">
                    No file selected
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Resizer col 2 */}
        <div onMouseDown={startAnalysisResize} className="resizer-col" />

        {/* Right Pane: Tomography Analysis Panel */}
        <div ref={analysisPanelRef} style={{ width: `${analysisWidth}px`, flexShrink: 0 }} className="bg-[#0a0a0a] border-l border-[#1f1f1f] flex flex-col justify-between p-4 space-y-4 shrink-0 overflow-y-auto select-none">
          <div className="space-y-4">
            
            {/* Header */}
            <div className="pb-3 border-b border-[#1f1f1f] flex items-center justify-between">
              <span className="font-heading font-bold text-sm text-white">Tomography Panel</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px]">
                Luminance: {luminance.toFixed(2)}
              </span>
            </div>

            {/* Panel Tabs: Active File vs Project Scan */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#050505] rounded-xl border border-[#1f1f1f] text-[11px] font-mono">
              <button
                onClick={() => setRightPanelTab("file")}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                  rightPanelTab === "file"
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Active File</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-300">
                  {findings.length}
                </span>
              </button>
              <button
                onClick={() => setRightPanelTab("project")}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                  rightPanelTab === "project"
                    ? "bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Project Scan</span>
                {workspaceReport && (
                  <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-[9px] text-purple-200">
                    {workspaceReport.total_ghost_lines}
                  </span>
                )}
              </button>
            </div>

            {rightPanelTab === "project" ? (
              /* Project Scan View */
              <div className="space-y-4">
                {/* Project Summary Metrics */}
                <div className="p-3 bg-[#050505] rounded-xl border border-[#1f1f1f] space-y-2 font-mono text-xs shadow-inner">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Files Scanned:</span>
                    <span className="text-cyan-400 font-bold">{workspaceReport?.files_scanned ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Ghost Lines:</span>
                    <span className="text-purple-400 font-bold">{workspaceReport?.total_ghost_lines ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Overall Ghost Ratio:</span>
                    <span className="text-amber-400 font-bold">
                      {workspaceReport ? `${(workspaceReport.ghost_ratio * 100).toFixed(1)}%` : "0.0%"}
                    </span>
                  </div>
                </div>

                {/* Ranked File Findings List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                    <span>Project Findings</span>
                    {workspaceReport && (
                      <span className="text-[10px] text-zinc-500 lowercase">by ghost ratio</span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
                    {workspaceReport && workspaceReport.files.length > 0 ? (
                      workspaceReport.files.map((file, i) => {
                        const hasGhosts = file.ghost_lines > 0;
                        return (
                          <button
                            key={i}
                            onClick={() => handleOpenWorkspaceFile(file)}
                            className="w-full text-left p-3 bg-[#050505] hover:bg-[#0d0d0d] hover:border-cyan-400 transition-all rounded-xl border border-zinc-800 space-y-1.5 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-200 font-bold group-hover:text-cyan-300 truncate max-w-[160px]">
                                {file.path}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                                  hasGhosts
                                    ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                                    : "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                                }`}
                              >
                                {file.ghost_lines} {file.ghost_lines === 1 ? "Ghost" : "Ghosts"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>LOC: {file.total_lines}</span>
                              <span className={hasGhosts ? "text-cyan-400 font-bold" : "text-zinc-500"}>
                                Ratio: {(file.ghost_ratio * 100).toFixed(1)}%
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono space-y-2">
                        <p>No project scan performed yet.</p>
                        <button
                          onClick={handleRunWorkspaceScan}
                          disabled={workspaceScanLoading}
                          className="px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold hover:bg-cyan-900 transition-all"
                        >
                          {workspaceScanLoading ? "Scanning..." : "Run Workspace Scan"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Active File View */
              <>
                {/* Causal Score Summary */}
                <div className="p-3 bg-[#050505] rounded-xl border border-[#1f1f1f] space-y-2 font-mono text-xs shadow-inner">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Causal Impact:</span>
                    <span className="text-cyan-400 font-bold">{luminance === 0.0 ? "0.00%" : "100.00%"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Ghost Lines:</span>
                    <span className="text-purple-400 font-bold">{findings.length}</span>
                  </div>
                </div>

                {/* Findings List (Clickable findings navigation) */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                    Detected Vacuous Lines
                  </span>

                  <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                    {findings.length > 0 ? (
                      findings.map((f, i) => {
                        const isSelected = selectedFinding?.line === f.line;
                        return (
                          <button
                            key={i}
                            onClick={() => handleFindingClick(f)}
                            className={`w-full text-left p-2.5 bg-[#050505] hover:bg-[#0d0d0d] transition-all rounded-xl border space-y-1 group ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-950/20 shadow-cyan-glow/20"
                                : "border-cyan-500/30 hover:border-cyan-400/80"
                            }`}
                          >
                            <div className="flex items-center justify-between text-cyan-400 font-bold group-hover:text-cyan-300">
                              <span className="flex items-center gap-1.5">
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                                Line {f.line}
                              </span>
                              <span className="text-[10px] bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-500/30">
                                {f.title}
                              </span>
                            </div>
                            <div className="text-zinc-300 font-mono bg-[#111111] p-1.5 rounded truncate">
                              {f.code}
                            </div>
                            <p className="text-[11px] text-zinc-400 font-sans leading-tight">
                              {f.reason}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono">
                        No vacuous ghost lines detected. Code is causally optimal.
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Provenance Replay Timeline Panel */}
                <div className="pt-3 border-t border-[#1f1f1f]">
                  <ProvenanceReplayPanel
                    finding={selectedFinding}
                    onStepClick={handleProvenanceStepClick}
                  />
                </div>
              </>
            )}

          </div>

          {/* Action Trigger */}
          <button
            onClick={handleOpenDiffPreview}
            disabled={findings.length === 0}
            className="w-full py-3 px-4 rounded-24 bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-cyan-glow transition-all disabled:opacity-40"
          >
            <Zap className="w-4 h-4 fill-black" />
            <span>Apply Safe Remove Surgery</span>
          </button>
        </div>

      </div>

      {/* Resizer row for console */}
      {showConsole && (
        <div onMouseDown={startConsoleResize} className="resizer-row" />
      )}

      {/* 3. Bottom Console Panel & Status Bar */}
      {showConsole && (
        <div style={{ height: `${consoleHeight}px` }} className="bg-[#070707] border-t border-[#1f1f1f] p-3 flex flex-col justify-between font-mono text-xs shrink-0 z-20">
          
          {/* Status Bar */}
          <div className="flex items-center justify-between text-zinc-400 text-[10px] pb-1 border-b border-[#181818]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-zinc-200">
                <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold">IPC ENGINE LOGS</span>
              </div>
              <span>File: <strong className="text-cyan-300">{activeTab?.name}</strong></span>
              <span>Lang: <strong className="text-purple-300">{getLanguageFromPath(activeTab?.path || "")}</strong></span>
              <span className="text-zinc-500">Analyzer: <strong className="text-emerald-400">Rust/Python AST Ready</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
              <span className="text-purple-400 font-bold">{findings.length} Ghost Lines</span>
              {activeTab?.isDirty ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> Unsaved Changes ●
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Console Logs Stream */}
          <div className="flex-1 overflow-y-auto space-y-1 pt-1 text-[11px] text-zinc-400">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-tight">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Right-Side Sliding Diff Drawer */}
      {diffDrawerOpen && diffData && (
        <div className="fixed inset-y-0 right-0 w-[540px] bg-[#0a0a0a] border-l border-cyan-500/40 shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-left">
          
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between bg-[#050505]">
            <div className="flex items-center gap-2 font-mono">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-heading font-bold text-sm text-white">Safe Remove Preview</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[11px]">
                {activeTab?.name}
              </span>
            </div>
            <button
              onClick={() => setDiffDrawerOpen(false)}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between font-mono text-xs px-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Ghost Lines:</span>
              <span className="text-purple-400 font-bold">{diffData.ghost_count_before}</span>
              <ArrowRight className="w-3 h-3 text-zinc-500" />
              <span className="text-cyan-400 font-bold">{diffData.ghost_count_after}</span>
            </div>

            <div className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/30 text-purple-300 text-[10px]">
              {diffData.changed_lines.length} lines transformed
            </div>
          </div>

          {/* Differential Behavioral Equivalence Verification Card */}
          <div className="p-3 mx-4 mt-3 bg-[#0d0d0d] border border-[#222] rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Behavioral Verification</span>
              </div>
              {verifying ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] animate-pulse">
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>Testing Subprocess...</span>
                </span>
              ) : verificationResult?.verified ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>EQUIVALENCE CONFIRMED</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>DIVERGENCE DETECTED</span>
                </span>
              )}
            </div>

            {verificationResult && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1a1a1a] text-[11px]">
                <div className="flex justify-between text-zinc-400">
                  <span>Output Match:</span>
                  <span className={verificationResult.outputs_match ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {verificationResult.outputs_match ? "Identical (100%)" : "Divergent"}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Perf Delta:</span>
                  <span className="text-cyan-300 font-bold">
                    {verificationResult.delta_ms > 0 ? `+${verificationResult.delta_ms}` : verificationResult.delta_ms}ms
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-[#050505]">
            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Unified AST Diff Stream</span>
            
            <div className="space-y-1 border border-[#1f1f1f] rounded-xl p-3 bg-[#0d0d0d]">
              {diffData.original_source.split("\n").map((origLine, idx) => {
                const lineNum = idx + 1;
                const isChanged = diffData.changed_lines.includes(lineNum);
                const transformedLines = diffData.transformed_source.split("\n");
                const newContent = transformedLines[idx] || "";

                if (isChanged) {
                  return (
                    <div key={lineNum} className="space-y-1 my-1">
                      <div className="px-2 py-1 bg-red-950/60 border-l-2 border-red-500 text-red-300 flex justify-between">
                        <span>- {lineNum}: {origLine}</span>
                        <span className="text-[9px] text-red-400 uppercase">Ghost</span>
                      </div>
                      <div className="px-2 py-1 bg-emerald-950/60 border-l-2 border-emerald-500 text-emerald-300 flex justify-between">
                        <span>+ {lineNum}: {newContent}</span>
                        <span className="text-[9px] text-emerald-400 uppercase">Optimal</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={lineNum} className="px-2 py-0.5 text-zinc-500">
                    &nbsp;&nbsp;{lineNum}: {origLine}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-[#1f1f1f] bg-[#0a0a0a] flex items-center justify-between font-mono text-xs">
            <button
              onClick={() => setDiffDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySafeRemove}
              disabled={verifying || (verificationResult !== null && !verificationResult.verified)}
              className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>Apply Surgery</span>
            </button>
          </div>

        </div>
      )}

      {/* Modals */}
      <ConfirmDialog
        isOpen={!!closeConfirmTab}
        fileName={closeConfirmTab?.name || ""}
        onSave={() => {
          if (closeConfirmTab) {
            handleSaveFile();
            executeCloseTab(closeConfirmTab.path);
            setCloseConfirmTab(null);
          }
        }}
        onDiscard={() => {
          if (closeConfirmTab) {
            executeCloseTab(closeConfirmTab.path);
            setCloseConfirmTab(null);
          }
        }}
        onCancel={() => setCloseConfirmTab(null)}
      />

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onOpenFolder={handleOpenFolder}
        onRunTomography={() => activeTabPath && runAnalysis(activeTabPath, activeTab.content)}
        onApplySafeRemove={handleOpenDiffPreview}
        onRestoreBackup={handleRestoreBackup}
        onToggleExplorer={() => setShowExplorer((prev) => !prev)}
        onToggleConsole={() => setShowConsole((prev) => !prev)}
        openTabs={openTabs.map((t) => ({ path: t.path, name: t.name }))}
        onSelectTab={(path) => {
          setActiveTabPath(path);
          restoreTabCursor(path);
        }}
      />

      <QuickOpen
        isOpen={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        files={fileList}
        onSelectFile={(path, name) => handleOpenFile({ name, path, isDirectory: false })}
      />

      {/* Startup Modal */}
      <StartupModal
        isOpen={startupModalOpen}
        onClose={() => setStartupModalOpen(false)}
        recentWorkspaces={recentWorkspaces}
        onOpenRecent={(path) => handleOpenRecentWorkspace(path)}
        onOpenFolder={handleOpenFolder}
        onOpenDemo={() => {
          if (folderPath) {
            handleRunWorkspaceScan();
          }
        }}
      />

    </div>
  );
}
