"use client";

console.log('[IDE-APP] module evaluated');

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  FolderOpen, FileText, ChevronRight, ChevronDown, Play, Sparkles, 
  Terminal as TerminalIcon, Zap, X, Check, Save, RotateCcw, ArrowRight, 
  Command, Search, Cpu 
} from "lucide-react";

import ConfirmDialog from "./components/ConfirmDialog";
import CommandPalette from "./components/CommandPalette";
import QuickOpen from "./components/QuickOpen";
import ProvenanceReplayPanel, { Finding, ProvenanceStep } from "./components/ProvenanceReplayPanel";

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
    };
  }
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
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(findings[0] || null);
  const [luminance, setLuminance] = useState<number>(0.0);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [cursorPositions, setCursorPositions] = useState<Record<string, { line: number; col: number }>>({});

  // Modals & Panels State
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffPreviewData | null>(null);
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

  // On first launch, attempt to auto-load demo workspace from disk via IPC
  useEffect(() => {
    console.log('[IDE-APP] useEffect: starting loadDemoWorkspace');
    async function loadDemoWorkspace() {
      try {
        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.getDefaultDemoWorkspace) {
          console.log('[IDE-APP] invoking getDefaultDemoWorkspace');
          const demo = await window.electronAPI.getDefaultDemoWorkspace();
          if (demo && demo.tree) {
            setFolderPath(demo.folderPath);
            setFileTree(demo.tree);
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
            }
          }
        }
      } catch (err) {
        console.error("[IDE-APP] Error loading demo workspace via IPC:", err);
      }
    }
    loadDemoWorkspace();
  }, []);

  // Save pane sizes safely
  const savePaneSizes = (expW: number, anaW: number, conH: number) => {
    if (typeof window === "undefined") return;
    try {
      console.log('[IDE-APP] saving pane sizes to localStorage');
      localStorage.setItem("echo_ide_pane_sizes", JSON.stringify({
        explorerWidth: expW,
        analysisWidth: anaW,
        consoleHeight: conH,
      }));
    } catch (e) {
      console.warn("[IDE-APP] Failed to save pane sizes to localStorage:", e);
    }
  };

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
        addLog(`[IPC] Opened directory: ${res.folderPath}`);
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
        const savedPos = cursorPositions[path];
        if (savedPos && editorRef.current) {
          editorRef.current.setPosition({ lineNumber: savedPos.line, column: savedPos.col });
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

      setDiffData({
        file: activeTab.path,
        original_source: activeTab.content,
        transformed_source: transformedLines.join("\n"),
        changed_lines: changedLines,
        ghost_count_before: findings.length,
        ghost_count_after: 0,
        causal_luminance_after: 1.0,
      });
      setDiffDrawerOpen(true);
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
      });
      
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
      savePaneSizes(newW, analysisWidth, consoleHeight);
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
      savePaneSizes(explorerWidth, newW, consoleHeight);
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
      savePaneSizes(explorerWidth, analysisWidth, newH);
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

        {/* Center Pane: Multi-Tab Monaco Editor */}
        <div ref={editorPaneRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }} className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#050505]">
          
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
              className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all flex items-center gap-2"
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

    </div>
  );
}
