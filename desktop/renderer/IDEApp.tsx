"use client";

console.log('[IDE-APP] module evaluated');

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  FolderOpen, FolderTree, FileText, ChevronRight, ChevronDown, Play, Sparkles, 
  Terminal as TerminalIcon, Zap, X, Check, Save, RotateCcw, ArrowRight, 
  Command, Search, Cpu, Layers, Activity, BarChart3, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert,
  LayoutDashboard, Clock, FileSearch, Network, Download, Flame, Sun, Moon, Copy, GitPullRequest, GitBranch, Compass, Globe, FileCode, Bug, Bot, FlaskConical,
  History as HistoryIcon, Camera, Square, StepForward
} from "lucide-react";

import ConfirmDialog from "./components/ConfirmDialog";
import CommandPalette from "./components/CommandPalette";
import QuickOpen from "./components/QuickOpen";
import ProvenanceReplayPanel, { Finding, ProvenanceStep } from "./components/ProvenanceReplayPanel";
import WorkspaceDashboard, { WorkspaceReport, WorkspaceFileReport } from "./components/WorkspaceDashboard";
import WorkspaceGraphPanel, { WorkspaceGraph, GraphNode } from "./components/WorkspaceGraphPanel";
import StartupModal from "./components/StartupModal";
import { runPython } from "../runtime/pythonRunner";
import { analyzePythonExecution, ExecutionAnalysis } from "../runtime/pythonExecutionAnalyzer";
import { debugPython, DebugStep } from "../runtime/pythonTimeTravelDebugger";
import DebuggerPanel from "./components/DebuggerPanel";
import LiveWebPreviewPanel from "./components/LiveWebPreviewPanel";
import { shouldShowPreview } from "../engine/live_web_preview";
import TerminalPanel from "./components/TerminalPanel";
import { useTerminal } from "./hooks/useTerminal";
import SourceControlPanel from "./components/SourceControlPanel";
import { useGit } from "./hooks/useGit";
import SearchPanel from "./components/SearchPanel";
import { useSearch, SearchMatchItem } from "./hooks/useSearch";
import InlineCodeActions from "./components/InlineCodeActions";
import UnifiedAIPanel from "./components/UnifiedAIPanel";
import { AIResponsePayload } from "./components/AIPanel";
import { AgentStep, ProposedEdit } from "./components/AgentPanel";
import SurgeryDiffPreview, { SurgeryApplyRequest } from "./components/SurgeryDiffPreview";
import WorkspaceSearchModal, { SearchMode, SearchResultItem } from "./components/WorkspaceSearchModal";
import ClonePanel, { CloneReport, CloneInstance } from "./components/ClonePanel";
import SemanticClonePanel, { SemanticCloneReport, SemanticCloneInstance } from "./components/SemanticClonePanel";
import CodeEditorPanel, { WorkspaceLuminanceReport, FileLuminanceReport, StatementLuminance } from "./components/CodeEditorPanel";
import SurgeryHistoryDrawer from "./components/SurgeryHistoryDrawer";
import RestoreConfirmModal from "./components/RestoreConfirmModal";
import BehaviorFingerprintPanel, { BehavioralFingerprintReport } from "./components/BehaviorFingerprintPanel";
import PatchFirewallPanel, { PatchFirewallReport } from "./components/PatchFirewallPanel";
import RepositoryPatchFirewallPanel, { RepositoryPatchFirewallReport } from "./components/RepositoryPatchFirewallPanel";
import SemanticIntentRadarPanel, { SemanticIntentDriftReport } from "./components/SemanticIntentRadarPanel";
import RecoveryDialog from "./components/RecoveryDialog";
import BDGInspectorPanel from "./components/BDGInspectorPanel";
import TestExplorerPanel from "./components/TestExplorerPanel";
import { useTests, TestCase } from "./hooks/useTests";
import ProfilerPanel from "./components/ProfilerPanel";
import { useProfiler } from "./hooks/useProfiler";
import SecurityAuditPanel from "./components/SecurityAuditPanel";
import TaskHome from "./components/TaskHome";
import AgentWorkspace from "./components/AgentWorkspace";
import ContextualToolsDrawer, { ToolTab } from "./components/ContextualToolsDrawer";
import { useSecurityAudit } from "./hooks/useSecurityAudit";
import SnapshotPanel from "./components/SnapshotPanel";
import { useSnapshots } from "./hooks/useSnapshots";
import { useWorkspaceState, EditorViewState, WorkspacePersistedState, RecoverySnapshot, safeParse } from "./hooks/useWorkspaceState";
import { buildWorkspaceReport, ReportExportPayload } from "./utils/reportBuilder";
import { exportGraphSvg } from "./utils/exportGraphSvg";

export interface StructuralCloneOccurrence {
  file: string;
  absolute_path: string;
  start_line: number;
  end_line: number;
  code: string;
  kind: string;
}

export interface StructuralCloneGroup {
  fingerprint: string;
  occurrences_count: number;
  occurrences: StructuralCloneOccurrence[];
}

export interface SemanticCloneGroup {
  fingerprint: string;
  occurrences_count: number;
  confidence: number;
  occurrences: StructuralCloneOccurrence[];
}

import MonacoEditor from "@monaco-editor/react";

declare global {
  interface Window {
    electronAPI?: {
      openFolder: () => Promise<{ folderPath: string; tree: any } | null>;
      getDefaultDemoWorkspace: () => Promise<{ folderPath: string; tree: any } | null>;
      readDir: (path: string) => Promise<any>;
      readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      fileExists: (path: string) => Promise<{ success: boolean; exists: boolean }>;
      analyzeFile: (payload: { filePath: string; content: string }) => Promise<any>;
      previewSafeRemove: (path: string) => Promise<any>;
      applySafeRemove: (path: string, transformedContent: string) => Promise<any>;
      restoreBackup: (path: string) => Promise<any>;
      scanWorkspace: (path: string) => Promise<any>;
      verifyEquivalence: (path: string, transformedContent: string) => Promise<any>;
      buildWorkspaceGraph: (path: string) => Promise<any>;
      loadWorkspaceState: () => Promise<any>;
      saveWorkspaceState: (state: any) => Promise<any>;
      exportWorkspaceReport: (payload: any) => Promise<{ success: boolean; path: string; htmlPath?: string; error?: string }>;
      previewSurgery: (payload: { file: string; approved_lines: number[] }) => Promise<any>;
      applySurgery: (payload: { file: string; approved_lines: number[] }) => Promise<{ success: boolean; file: string; removed_count: number; backup_path: string; new_hash: string; transformed_content: string; error?: string }>;
      undoSurgery: (payload: { file: string }) => Promise<{ success: boolean; file: string; restored_content: string; backup_path: string; error?: string }>;
      verifySurgery: (payload: { original_path: string; transformed_source: string }) => Promise<any>;
      searchWorkspace: (payload: { workspace: string; query?: string; mode?: string; limit?: number }) => Promise<{ workspace: string; query: string; mode: string; results_count: number; results: SearchResultItem[]; error?: string }>;
      detectClones: (workspacePath: string) => Promise<CloneReport>;
      scanStructuralClones: (workspacePath: string) => Promise<StructuralCloneGroup[]>;
      scanSemanticClones: (workspacePath: string) => Promise<SemanticCloneGroup[]>;
      detectSemanticClones: (workspacePath: string) => Promise<SemanticCloneReport>;
      calculateLuminance: (workspacePath: string) => Promise<WorkspaceLuminanceReport>;
      listHistory: () => Promise<{ success: boolean; entries: HistoryEntry[]; error?: string }>;
      getHistory: (id: string) => Promise<{ success: boolean; entry?: HistoryEntry; error?: string }>;
      restoreHistory: (id: string) => Promise<{ success: boolean; file: string; restored_content: string; checkpoint_id: string; entry?: HistoryEntry; error?: string }>;
      appendHistory: (entry: Partial<HistoryEntry>) => Promise<{ success: boolean; entry?: HistoryEntry; error?: string }>;
      analyzeSemanticIntentDrift: (payload: { original_source: string; edited_source: string; language?: string; function_name?: string }) => Promise<SemanticIntentDriftReport>;
      runPythonFile: (filePath: string) => Promise<{ success: boolean; exitCode?: number; error?: string }>;
      onPythonOutput: (callback: (payload: { filePath?: string; data?: string; type?: 'stdout' | 'stderr' | 'exit'; exitCode?: number; isError?: boolean }) => void) => () => void;
      terminal?: {
        create: (options?: { cwd?: string; shell?: string; cols?: number; rows?: number }) => Promise<{ id: string; pid: number; shell: string; cwd: string; status: string }>;
        write: (id: string, data: string) => Promise<void>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        kill: (id: string) => Promise<void>;
        restart: (id: string) => Promise<{ id: string; pid: number; shell: string; cwd: string; status: string }>;
        list: () => Promise<Array<{ id: string; pid: number; shell: string; cwd: string; status: string }>>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; exitCode: number; signal?: number }) => void) => () => void;
      };
      git?: {
        status: (workspacePath: string) => Promise<any>;
        diff: (workspacePath: string, file: string, staged?: boolean) => Promise<{ success: boolean; diff: string; originalContent: string; currentContent: string; error?: string }>;
        stage: (workspacePath: string, file: string) => Promise<any>;
        unstage: (workspacePath: string, file: string) => Promise<any>;
        stageAll: (workspacePath: string) => Promise<any>;
        unstageAll: (workspacePath: string) => Promise<any>;
        commit: (workspacePath: string, message: string) => Promise<{ success: boolean; commitResult?: any; status?: any; error?: string }>;
        branches: (workspacePath: string) => Promise<{ all: string[]; current: string }>;
        checkout: (workspacePath: string, branch: string) => Promise<any>;
        createBranch: (workspacePath: string, branch: string) => Promise<any>;
        discard: (workspacePath: string, file: string) => Promise<any>;
      };
      search?: {
        run: (payload: any) => Promise<{ success: boolean; results: SearchMatchItem[]; totalFiles: number; totalMatches: number; durationMs: number; error?: string }>;
        replace: (payload: any) => Promise<{ success: boolean; file: string; line: number; newContent: string; error?: string }>;
        replaceAll: (payload: any) => Promise<{ success: boolean; filesChanged: number; replacementsCount: number; error?: string }>;
        cancel: (id: string) => Promise<void>;
      };
      ai?: {
        codeAction: (payload: {
          action: string;
          language: string;
          filePath: string;
          selection: string;
          fullFile: string;
        }) => Promise<AIResponsePayload>;
      };
      continuum?: {
        save: (snapshot: any, workspacePath: string) => Promise<any>;
        list: (workspacePath: string) => Promise<any[]>;
        load: (snapshotId: string, workspacePath: string) => Promise<any>;
        delete: (snapshotId: string, workspacePath: string) => Promise<any>;
        buildContext: (snapshot: any) => Promise<any>;
        createCurrent: (payload: any, workspacePath: string) => Promise<any>;
        resumeSession: (snapshotId: string, workspacePath: string) => Promise<any>;
        exportCapsule: (payload: { snapshotId?: string; snapshot?: any; workspacePath?: string; exportMode?: 'INLINE' | 'REFERENCE_ONLY'; options?: any }) => Promise<{ success: boolean; capsuleId?: string; path?: string; capsuleMeta?: any; capsule?: any; error?: string }>;
        importCapsule: (payload: { capsulePath?: string; capsuleSerialized?: string; capsule?: any; workspacePath?: string }) => Promise<{ success: boolean; nextSnapshotId?: string; parentSessionId?: string; sequenceNumber?: number; contextText?: string; nextSnapshot?: any; capsuleMeta?: any; handoffContext?: any; error?: string }>;
        openCapsuleDialog: () => Promise<string | null>;
      };
    };
  }
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  file_path: string;
  operation_type: "APPLY_SURGERY" | "UNDO_SURGERY" | "RESTORE_CHECKPOINT";
  removed_lines: number[];
  before_hash: string;
  after_hash: string;
  before_source: string;
  after_source: string;
  behavior_preserved: boolean;
  luminance_before: number;
  luminance_after: number;
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.warn('[NAVIGATION] unexpected unload triggered');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (typeof window !== "undefined" && (window as any).electronAPI?.hardening) {
      (window as any).electronAPI.hardening.trackTelemetry('appLaunches').catch(() => {});
      (window as any).electronAPI.hardening.checkHealth().then((res: any) => {
        if (res && res.warnings && res.warnings.length > 0) {
          console.warn('[HEALTH-CHECK] Startup warnings:', res.warnings);
        }
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      console.log('[IDE-APP] unmounted');
    };
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
  type MainView = "editor" | "dashboard" | "graph" | "clones" | "semantic_clones" | "luminance" | "behavior_fingerprint" | "patch_firewall" | "repository_patch_firewall" | "semantic_intent_radar" | "source_control" | "search" | "test_explorer" | "profiler" | "security_audit" | "snapshots";
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(findings[0] || null);
  const [workspaceReport, setWorkspaceReport] = useState<WorkspaceReport | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceReport | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceScanLoading, setWorkspaceScanLoading] = useState(false);
  const [mainView, setMainView] = useState<MainView>("editor");

  const testsHook = useTests(folderPath || "");
  const testDecorationIdsRef = useRef<string[]>([]);

  const profiler = useProfiler();
  const profilerDecorationIdsRef = useRef<string[]>([]);

  const securityAudit = useSecurityAudit(folderPath || "");
  const securityDecorationIdsRef = useRef<string[]>([]);

  const snapshotHook = useSnapshots(folderPath || "");

  const git = useGit(folderPath || "");
  const [gitDiffModalFile, setGitDiffModalFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [gitDiffData, setGitDiffData] = useState<{ original: string; current: string; diff: string } | null>(null);

  const handleOpenGitDiff = async (filePath: string, staged: boolean) => {
    setGitDiffModalFile({ path: filePath, staged });
    const diffRes = await git.getFileDiff(filePath, staged);
    if (diffRes) {
      setGitDiffData({
        original: diffRes.originalContent || "",
        current: diffRes.currentContent || "",
        diff: diffRes.diff || "",
      });
    }
  };

  const search = useSearch(folderPath || "");
  const searchMatchDecorationIdsRef = useRef<string[]>([]);
  const [cloneReport, setCloneReport] = useState<CloneReport | null>(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [semanticCloneReport, setSemanticCloneReport] = useState<SemanticCloneReport | null>(null);
  const [semanticCloneLoading, setSemanticCloneLoading] = useState(false);
  const [luminanceReport, setLuminanceReport] = useState<WorkspaceLuminanceReport | null>(null);
  const [luminanceLoading, setLuminanceLoading] = useState(false);
  const [fingerprintReport, setFingerprintReport] = useState<BehavioralFingerprintReport | null>(null);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [patchFirewallReport, setPatchFirewallReport] = useState<PatchFirewallReport | null>(null);
  const [patchFirewallLoading, setPatchFirewallLoading] = useState(false);
  const [repositoryFirewallReport, setRepositoryFirewallReport] = useState<RepositoryPatchFirewallReport | null>(null);
  const [repositoryFirewallLoading, setRepositoryFirewallLoading] = useState(false);
  const [semanticIntentReport, setSemanticIntentReport] = useState<SemanticIntentDriftReport | null>(null);
  const [semanticIntentLoading, setSemanticIntentLoading] = useState(false);

  // AI-Native Workspace & Contextual Tools State
  const [workspaceMode, setWorkspaceMode] = useState<"home" | "agent" | "editor">("home");
  const [activeTaskPrompt, setActiveTaskPrompt] = useState<string>("");
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState<boolean>(false);
  const [toolsDrawerTab, setToolsDrawerTab] = useState<ToolTab>("explorer");

  // AI Code Actions State & Handlers
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelMode, setAiPanelMode] = useState<"code-action" | "agent">("agent");
  const [aiResponse, setAiResponse] = useState<AIResponsePayload | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    x: number;
    y: number;
    startLineNumber: number;
    endLineNumber: number;
    startColumn: number;
    endColumn: number;
  } | null>(null);
  const selectionInfoRef = useRef(selectionInfo);
  selectionInfoRef.current = selectionInfo;

  const handleRunAiCodeAction = async (action: "explain" | "find_bug" | "fix" | "refactor" | "tests" | "docs") => {
    const sel = selectionInfoRef.current;
    if (!sel || !sel.text || !sel.text.trim()) {
      addLog("[AI] No code selected. Please select a snippet in the editor first.");
      return;
    }

    setAiPanelMode("code-action");
    setAiPanelOpen(true);
    setAiLoading(true);
    setAiResponse(null);
    addLog(`[AI] Running ${action.toUpperCase()} action on ${sel.endLineNumber - sel.startLineNumber + 1} lines...`);

    try {
      if (typeof window !== "undefined" && window.electronAPI?.ai) {
        const lang = getLanguageFromPath(activeTabPath || "");
        const res = await window.electronAPI.ai.codeAction({
          action,
          language: lang,
          filePath: activeTabPath || "",
          selection: sel.text,
          fullFile: activeTab?.content || "",
        });
        setAiResponse(res);
        if (res.success) {
          addLog(`[AI] Action ${action} completed successfully.`);
        } else {
          addLog(`[AI] Action error: ${res.error || "failed"}`);
        }
      }
    } catch (err: any) {
      setAiResponse({
        success: false,
        action,
        error: err.message || String(err),
        response: "Failed to communicate with AI subsystem.",
      });
      addLog(`[AI] Communication error: ${err.message || String(err)}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzeSemanticIntentDrift = async (origCode: string, editCode: string) => {
    setSemanticIntentLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.analyzeSemanticIntentDrift) {
        const res = await window.electronAPI.analyzeSemanticIntentDrift({
          original_source: origCode,
          edited_source: editCode,
          language: getLanguageFromPath(activeTabPath),
        });
        setSemanticIntentReport(res);
      } else {
        const { analyzeSemanticIntentDrift } = require("../../desktop/engine/semantic_intent_drift");
        const res = analyzeSemanticIntentDrift({ original_source: origCode, edited_source: editCode });
        setSemanticIntentReport(res);
      }
    } catch (e: any) {
      setSemanticIntentReport({
        schema_version: 1,
        function_name: "target_function",
        drift_score: 0.0,
        drift_level: "NONE",
        intent_changes: [],
        confidence: 0.0,
        summary: "Error running Intent Drift analysis",
        error: e.message,
      });
    } finally {
      setSemanticIntentLoading(false);
    }
  };
  const [workspaceGraph, setWorkspaceGraph] = useState<WorkspaceGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [impactRadiusResult, setImpactRadiusResult] = useState<any>(null);
  const [blastRadiusResult, setBlastRadiusResult] = useState<any>(null);
  const [counterfactualResult, setCounterfactualResult] = useState<any>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [startupModalOpen, setStartupModalOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"file" | "project" | "clones" | "semantic" | "bdg">("file");
  const [structuralCloneGroups, setStructuralCloneGroups] = useState<StructuralCloneGroup[]>([]);
  const [structuralCloneLoading, setStructuralCloneLoading] = useState(false);
  const [semanticCloneGroups, setSemanticCloneGroups] = useState<SemanticCloneGroup[]>([]);
  const [semanticCloneScanLoading, setSemanticCloneScanLoading] = useState(false);
  const [luminance, setLuminance] = useState<number>(0.0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pythonOutput, setPythonOutput] = useState<string>("");
  const [pythonRunning, setPythonRunning] = useState<boolean>(false);
  const [executionAnalysis, setExecutionAnalysis] = useState<ExecutionAnalysis | null>(null);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [showTerminalPanel, setShowTerminalPanel] = useState<boolean>(false);
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState<boolean>(false);
  const [terminalPanelMode, setTerminalPanelMode] = useState<"terminal" | "output" | "debug">("terminal");
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [activeActivity, setActiveActivity] = useState<"explorer" | "search" | "git" | "debug" | "analysis" | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);

  const {
    tabs: terminalTabs,
    activeTabId: activeTerminalTabId,
    setActiveTabId: setActiveTerminalTabId,
    createTerminalTab,
    closeTerminalTab,
    restartTerminalTab,
    sendTerminalInput,
    appendOutputToTab,
  } = useTerminal(folderPath || "");

  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [debugIndex, setDebugIndex] = useState<number>(0);
  const [debugRunning, setDebugRunning] = useState<boolean>(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string | undefined>(undefined);
  const debugDecorationIdsRef = useRef<string[]>([]);
  const debugStepsRef = useRef(debugSteps);
  debugStepsRef.current = debugSteps;
  const debugIndexRef = useRef(debugIndex);
  debugIndexRef.current = debugIndex;

  const [agentRunningCommandOutput, setAgentRunningCommandOutput] = useState<string>("");

  const handleApplyAgentStep = async (step: AgentStep): Promise<boolean> => {
    if (!step.proposedEdits || step.proposedEdits.length === 0) return true;
    for (const edit of step.proposedEdits) {
      const filePath = edit.filePath;
      try {
        let currentContent = "";
        if (typeof window !== "undefined" && (window as any).electronAPI?.readFile) {
          currentContent = await (window as any).electronAPI.readFile(filePath);
        } else {
          const tab = openTabs.find((t) => t.path === filePath);
          currentContent = tab ? tab.content : "";
        }

        let newContent = currentContent;
        if (edit.original && currentContent.includes(edit.original)) {
          newContent = currentContent.replace(edit.original, edit.replacement);
        } else {
          newContent = edit.replacement;
        }

        if (typeof window !== "undefined" && (window as any).electronAPI?.writeFile) {
          await (window as any).electronAPI.writeFile(filePath, newContent);
        }

        // Update tab if open
        setOpenTabs((prev) =>
          prev.map((t) => (t.path === filePath ? { ...t, content: newContent, isDirty: false } : t))
        );
        addLog(`[AGENT] Applied edit to ${filePath}`);
      } catch (err: any) {
        addLog(`[AGENT ERROR] Failed to apply edit to ${filePath}: ${err.message}`);
        return false;
      }
    }
    return true;
  };

  const handleApplyAllAgentApproved = async (
    approvedSteps: AgentStep[],
    createCommit: boolean,
    verifyCmd: string
  ) => {
    for (const step of approvedSteps) {
      await handleApplyAgentStep(step);
    }

    if (
      createCommit &&
      git.isRepo &&
      typeof window !== "undefined" &&
      (window as any).electronAPI?.git?.stageAll &&
      (window as any).electronAPI?.git?.commit
    ) {
      try {
        await (window as any).electronAPI.git.stageAll(folderPath);
        const commitMsg = `agent: applied ${approvedSteps.length} autonomous steps`;
        await (window as any).electronAPI.git.commit(folderPath, commitMsg);
        git.refreshStatus();
        addLog(`[AGENT GIT] Created commit: "${commitMsg}"`);
      } catch (e: any) {
        addLog(`[AGENT GIT ERROR] ${e.message}`);
      }
    }

    if (verifyCmd && verifyCmd.trim()) {
      setAgentRunningCommandOutput(`$ ${verifyCmd}\nRunning verification...\n`);
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.terminal?.create &&
        (window as any).electronAPI?.terminal?.write
      ) {
        try {
          const term = await (window as any).electronAPI.terminal.create({
            cwd: folderPath || process.cwd(),
          });
          (window as any).electronAPI.terminal.write(term.id, `${verifyCmd}\n`);
          setAgentRunningCommandOutput((prev) => prev + `Command dispatched to Terminal (${term.id})\n`);
        } catch (err: any) {
          setAgentRunningCommandOutput((prev) => prev + `[ERROR] Failed to run command: ${err.message}\n`);
        }
      }
    }
  };

  const handleRunPythonDebugger = async () => {
    if (!activeTab || !activeTab.path.endsWith(".py")) return;
    setDebugRunning(true);
    setDebugError(undefined);
    addLog(`[DEBUGGER] Starting time-travel trace on ${activeTab.name}...`);

    try {
      console.log("[DEBUGGER] typeof debugPython =", typeof debugPython);
      if (typeof debugPython !== "function") {
        throw new Error("debugPython import is not a function");
      }
      const res = await debugPython(activeTab.content);
      if (res.steps && res.steps.length > 0) {
        setDebugSteps(res.steps);
        setDebugIndex(0);
        setDebugPanelOpen(true);
        setDebugError(res.error);
        addLog(`[DEBUGGER] Captured ${res.steps.length} execution steps.`);
      } else if (!res.success && res.error) {
        setDebugError(res.error);
        setDebugPanelOpen(true);
        addLog(`[DEBUGGER] Execution error: ${res.error}`);
      } else {
        addLog(`[DEBUGGER] No execution steps captured.`);
      }
    } catch (err: any) {
      addLog(`[DEBUGGER] Failed to trace Python execution: ${err.message || String(err)}`);
    } finally {
      setDebugRunning(false);
    }
  };

  const handleExecutePython = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log('[PYTHON] Button clicked');

    if (!activeTab || !activeTab.path) {
      addLog("[RUN] Error: No active file selected.");
      console.log('[PYTHON] Aborted: No active file');
      return;
    }
    if (!activeTab.path.endsWith(".py")) {
      addLog("[RUN] Error: Active file is not a Python (.py) file.");
      console.log('[PYTHON] Aborted: Not a .py file');
      return;
    }

    // Save active tab before executing
    if (activeTab.isDirty) {
      await handleSaveFile();
    }

    setPythonRunning(true);
    setShowTerminalPanel(true);
    setTerminalPanelMode("terminal");
    if (consoleHeight < 180) {
      setConsoleHeight(240);
    }

    // Ensure a terminal tab exists or create one
    let targetTabId = activeTerminalTabId;
    if (!targetTabId || terminalTabs.length === 0) {
      const createdId = await createTerminalTab(folderPath || undefined);
      if (createdId) targetTabId = createdId;
    }

    const fileName = activeTab.name || activeTab.path.split("/").pop() || "script.py";
    const headerLine = `▶ Running ${fileName}`;

    if (targetTabId) {
      appendOutputToTab(targetTabId, headerLine);
    }

    console.log('[PYTHON] Subscribing to output');
    let unbindListener: (() => void) | null = null;
    if (typeof window !== "undefined" && (window as any).electronAPI?.onPythonOutput) {
      unbindListener = (window as any).electronAPI.onPythonOutput((payload: any) => {
        console.log('[PYTHON] Renderer received', payload);
        if (!targetTabId) return;
        if (payload.data) {
          appendOutputToTab(targetTabId, payload.data);
        }
        if (payload.type === "exit" && payload.exitCode !== undefined) {
          const icon = payload.exitCode === 0 ? "✔" : "✖";
          appendOutputToTab(targetTabId, `${icon} Process exited with code ${payload.exitCode}`);
        }
      });
    }

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.runPythonFile) {
        const res = await (window as any).electronAPI.runPythonFile(activeTab.path);
        console.log('[PYTHON] Run result', res);
        if (!res.success && res.error) {
          if (targetTabId) {
            appendOutputToTab(targetTabId, `✖ Error: ${res.error}`);
          }
        }
      } else {
        // Fallback for non-Electron environment
        const res = await runPython(activeTab.content);
        let outStr = res.stdout || "";
        if (res.stderr) outStr += (outStr ? "\n" : "") + res.stderr;
        if (targetTabId) {
          if (outStr) appendOutputToTab(targetTabId, outStr);
          appendOutputToTab(targetTabId, "✔ Process exited with code 0");
        }
      }
    } catch (err: any) {
      console.error('[PYTHON] Execution error', err);
      if (targetTabId) {
        appendOutputToTab(targetTabId, `✖ Process execution error: ${err.message || String(err)}`);
      }
    } finally {
      if (unbindListener) unbindListener();
      setPythonRunning(false);
    }
  };

  // Monaco Line Highlight for Time-Travel Debugger Step
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!debugPanelOpen || debugSteps.length === 0 || debugIndex < 0 || debugIndex >= debugSteps.length) {
      if (debugDecorationIdsRef.current.length > 0) {
        try {
          debugDecorationIdsRef.current = editor.deltaDecorations(debugDecorationIdsRef.current, []);
        } catch (e) {}
      }
      return;
    }

    const step = debugSteps[debugIndex];
    if (!step || !step.line) return;

    try {
      const newDecorations = [
        {
          range: new monaco.Range(step.line, 1, step.line, 1),
          options: {
            isWholeLine: true,
            className: "bg-cyan-950/60 border-l-4 border-cyan-400 font-bold",
            glyphMarginClassName: "codicon codicon-arrow-right text-cyan-400 font-bold",
          },
        },
      ];

      debugDecorationIdsRef.current = editor.deltaDecorations(debugDecorationIdsRef.current, newDecorations);
      editor.revealLineInCenter(step.line);
    } catch (e) {}
  }, [debugIndex, debugSteps, debugPanelOpen]);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectedCodeSymbol, setSelectedCodeSymbol] = useState<string>("");
  const [cursorPositions, setCursorPositions] = useState<Record<string, { line: number; col: number }>>({});

  const activeFileLuminance = useMemo<FileLuminanceReport | null>(() => {
    if (!luminanceReport || !activeTabPath || typeof activeTabPath !== "string") return null;
    const base = activeTabPath.split("/").pop() || "";
    return luminanceReport.files.find((f) => f && f.file && typeof f.file === "string" ? (activeTabPath.endsWith(f.file) || f.file.endsWith(base)) : false) || null;
  }, [luminanceReport, activeTabPath]);

  // Persistence Hook & Editor State Tracking
  const { loadedState, requestSave, requestRecoverySnapshot, flushRecoverySnapshot, hasLoaded } = useWorkspaceState();
  const editorStatesRef = useRef<Record<string, EditorViewState>>({});
  const isStateRestoredRef = useRef<boolean>(false);

  // Crash Recovery & Session Restore State
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoverySnapshot | null>(null);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState<boolean>(false);
  const [wasCrashDetected, setWasCrashDetected] = useState<boolean>(false);
  const recoveryCheckedRef = useRef<boolean>(false);

  // Check for recovery snapshot on workspace load
  useEffect(() => {
    if (!folderPath || recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;

    async function checkRecovery() {
      if (typeof window !== "undefined" && (window as any).electronAPI?.recovery) {
        try {
          const crashInfo = await (window as any).electronAPI.recovery.checkCrash();
          if (crashInfo && crashInfo.wasCrash) {
            setWasCrashDetected(true);
          }

          const snapshot = await (window as any).electronAPI.recovery.load(folderPath);
          if (snapshot && snapshot.openTabs && snapshot.openTabs.some((t: any) => t.isDirty)) {
            setRecoverySnapshot(snapshot);
            setRecoveryDialogOpen(true);
            addLog(`[RECOVERY] Found recovery snapshot with ${snapshot.openTabs.length} tabs.`);
          }
        } catch (e) {
          console.error("[RECOVERY] Failed to check recovery snapshot:", e);
        }
      }
    }

    checkRecovery();
  }, [folderPath]);

  // Request recovery snapshot whenever openTabs or activeTabPath changes
  useEffect(() => {
    if (!folderPath || !hasLoaded) return;
    requestRecoverySnapshot({
      workspacePath: folderPath,
      openTabs: openTabs.map((t) => ({
        path: t.path,
        content: t.content,
        isDirty: !!t.isDirty,
      })),
      activeTabPath: activeTabPath || null,
    });
  }, [openTabs, activeTabPath, folderPath, hasLoaded, requestRecoverySnapshot]);

  const handleRestoreSession = () => {
    if (!recoverySnapshot || !recoverySnapshot.openTabs) return;
    const restoredTabs = recoverySnapshot.openTabs.map((t) => ({
      name: t.path.split("/").pop() || t.path,
      path: t.path,
      content: t.content,
      savedContent: t.content,
      isDirty: !!t.isDirty,
    }));

    setOpenTabs(restoredTabs);
    if (recoverySnapshot.activeTabPath) {
      setActiveTabPath(recoverySnapshot.activeTabPath);
    }
    setRecoveryDialogOpen(false);
    addLog(`[RECOVERY] Restored session with ${restoredTabs.length} tabs.`);
  };

  const handleDiscardRecovery = async () => {
    if (folderPath && typeof window !== "undefined" && (window as any).electronAPI?.recovery?.clear) {
      try {
        await (window as any).electronAPI.recovery.clear(folderPath);
      } catch (e) {}
    }
    setRecoverySnapshot(null);
    setRecoveryDialogOpen(false);
    addLog(`[RECOVERY] Discarded recovery snapshot.`);
  };

  // Modals & Panels State
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [showSurgeryDiffModal, setShowSurgeryDiffModal] = useState(false);
  const [undoAvailableForFile, setUndoAvailableForFile] = useState<Record<string, boolean>>({});
  const [applyingSurgery, setApplyingSurgery] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchModalMode, setSearchModalMode] = useState<SearchMode>("files");
  const [searchModalQuery, setSearchModalQuery] = useState("");
  const [diffData, setDiffData] = useState<DiffPreviewData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [behaviorResult, setBehaviorResult] = useState<any | null>(null);
  const [behaviorVerifying, setBehaviorVerifying] = useState(false);
  const [showForceApplyConfirm, setShowForceApplyConfirm] = useState(false);

  const handleAiPreviewDiff = async (patch: { original: string; replacement: string }) => {
    if (!activeTab) return;

    const newContent = activeTab.content.replace(patch.original, patch.replacement);

    // 1. Evaluate Semantic Intent Drift
    try {
      if (typeof window !== "undefined" && window.electronAPI?.analyzeSemanticIntentDrift) {
        const driftRes = await window.electronAPI.analyzeSemanticIntentDrift({
          original_source: activeTab.content,
          edited_source: newContent,
          language: getLanguageFromPath(activeTab.path),
        });
        if (driftRes && driftRes.drift_level === "HIGH") {
          addLog(`[AI-FIREWALL] ⚠️ Warning: High semantic intent drift detected (${driftRes.drift_score}%). Please inspect changes carefully.`);
        }
      }
    } catch (e) {}

    // 2. Open Surgery Diff Preview
    setDiffData({
      file: activeTab.path,
      original_source: activeTab.content,
      transformed_source: newContent,
      changed_lines: [selectionInfoRef.current?.startLineNumber || 1],
      ghost_count_before: findings.length,
      ghost_count_after: findings.length,
      causal_luminance_after: 1.0,
    });
    setDiffDrawerOpen(true);
    setShowSurgeryDiffModal(true);
  };

  const handleAiApplyPatch = (patch: { original: string; replacement: string }) => {
    if (!activeTab) return;
    handleAiPreviewDiff(patch);
  };

  // History & Time Travel State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<HistoryEntry | null>(null);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(false);

  const refreshHistory = async () => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.listHistory) {
      try {
        const res = await window.electronAPI.listHistory();
        if (res && res.success) {
          setHistoryEntries(res.entries || []);
        }
      } catch (e) {
        console.error("Failed to list history:", e);
      }
    }
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const handleRestoreCheckpoint = async (id: string) => {
    if (!id || typeof window === "undefined" || !window.electronAPI || !window.electronAPI.restoreHistory) return;
    setRestoringHistory(true);
    addLog(`[HISTORY] Restoring surgery checkpoint: ${id}...`);
    try {
      const res = await window.electronAPI.restoreHistory(id);
      if (res && res.success) {
        addLog(`[HISTORY] Restored surgery checkpoint ${id}. Source reverted on disk.`);
        setShowRestoreConfirmModal(false);
        if (res.file && res.restored_content) {
          const tabIndex = openTabs.findIndex(t => t.path === res.file);
          if (tabIndex !== -1) {
            setOpenTabs(prev => prev.map((t, idx) => idx === tabIndex ? { ...t, content: res.restored_content, isDirty: false } : t));
          }
          runAnalysis({ path: res.file, name: res.file.split("/").pop() || "file", content: res.restored_content, savedContent: res.restored_content, isDirty: false });
        }
        handleRunWorkspaceScan();
        handleLoadWorkspaceGraph();
        handleScanStructuralClones();
        handleScanSemanticClones();
        handleRunLuminanceScan();
        refreshHistory();
      } else {
        addLog(`[HISTORY] Restore failed: ${res?.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Failed to restore checkpoint:", e);
      addLog(`[HISTORY] Error restoring checkpoint: ${e.message}`);
    } finally {
      setRestoringHistory(false);
    }
  };

  useEffect(() => {
    const handleMockFailure = () => {
      setBehaviorResult({
        behavior_preserved: false,
        original: { stdout: "x = 6\n", stderr: "", exit_code: 0, exception: null },
        transformed: { stdout: "x = 5\n", stderr: "", exit_code: 0, exception: null },
        differences: ["stdout mismatch: original '6' vs transformed '5'"]
      });
    };
    const handleMockHistory = () => {
      setHistoryDrawerOpen(true);
      refreshHistory();
    };
    const handleMockRestoreConfirm = () => {
      const currentTab = openTabs.find(t => t.path === activeTabPath) || openTabs[0];
      const fallbackEntry: HistoryEntry = {
        id: "surg-1786568000-cart-v1",
        timestamp: new Date().toISOString(),
        file_path: currentTab?.path || "/Users/umangmalhotra/Documents/Echo Nullity/demo-workspaces/ai_cart_project/src/cart_calculator.py",
        operation_type: "APPLY_SURGERY",
        removed_lines: [9, 10, 11, 12],
        before_hash: "a1b2c3d4e5f67890",
        after_hash: "0987654321fedcba",
        before_source: currentTab?.content || "def calculate_cart_total(items):\n    subtotal = sum(item['price'] * item['quantity'] for item in items)\n    subtotal = subtotal * 1\n    subtotal = subtotal + 0\n    subtotal = subtotal - 0\n    subtotal = subtotal / 1\n    return subtotal\n",
        after_source: "def calculate_cart_total(items):\n    subtotal = sum(item['price'] * item['quantity'] for item in items)\n    return subtotal\n",
        behavior_preserved: true,
        luminance_before: 0.65,
        luminance_after: 1.00
      };
      setSelectedHistoryEvent(historyEntries[0] || fallbackEntry);
      setShowRestoreConfirmModal(true);
    };
    const handleMockExecuteRestore = () => {
      if (historyEntries.length > 0) {
        handleRestoreCheckpoint(historyEntries[0].id);
      } else {
        addLog("[HISTORY] Restored surgery checkpoint surg-1786568000-cart-v1.");
        setShowRestoreConfirmModal(false);
        handleRunWorkspaceScan();
        handleLoadWorkspaceGraph();
        handleScanStructuralClones();
        handleScanSemanticClones();
        handleRunLuminanceScan();
      }
    };
    window.addEventListener("mock-verify-failure", handleMockFailure);
    window.addEventListener("mock-history-drawer", handleMockHistory);
    window.addEventListener("mock-restore-confirm", handleMockRestoreConfirm);
    window.addEventListener("mock-execute-restore", handleMockExecuteRestore);
    return () => {
      window.removeEventListener("mock-verify-failure", handleMockFailure);
      window.removeEventListener("mock-history-drawer", handleMockHistory);
      window.removeEventListener("mock-restore-confirm", handleMockRestoreConfirm);
      window.removeEventListener("mock-execute-restore", handleMockExecuteRestore);
    };
  }, [historyEntries, openTabs, activeTabPath]);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [closeConfirmTab, setCloseConfirmTab] = useState<TabItem | null>(null);

  // Pane Visibility & Resizing
  const [showExplorer, setShowExplorer] = useState(false);
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

  // Test & Coverage Gutter Decorations in Monaco
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: any[] = [];

    // 1. Test Passing / Failing Status Decorations
    const fileTests = testsHook.testFiles.find((f) => f.filePath === activeTab.path);
    if (fileTests) {
      const flattenTests = (children: any[]): TestCase[] => {
        let acc: TestCase[] = [];
        for (const c of children) {
          if (c.type === "test") acc.push(c);
          else if (c.children) acc = acc.concat(flattenTests(c.children));
        }
        return acc;
      };

      const allCases = flattenTests(fileTests.children);
      allCases.forEach((tc) => {
        if (tc.line) {
          const isPassed = tc.status === "passed";
          const isFailed = tc.status === "failed";
          if (isPassed || isFailed) {
            newDecorations.push({
              range: new monaco.Range(tc.line, 1, tc.line, 1),
              options: {
                isWholeLine: false,
                glyphMarginClassName: isPassed
                  ? "bg-emerald-500 rounded-full w-2 h-2 ml-1"
                  : "bg-rose-500 rounded-full w-2 h-2 ml-1",
                glyphMarginHoverMessage: {
                  value: `${tc.name}: ${tc.status.toUpperCase()} (${tc.durationMs || 0}ms)`,
                },
              },
            });
          }
        }
      });
    }

    // 2. Uncovered Lines Highlight from Coverage Data
    if (testsHook.coverageData) {
      const covFile = testsHook.coverageData.files.find(
        (f) => f.filePath === activeTab.path || activeTab.path.endsWith(f.name)
      );
      if (covFile && covFile.uncoveredLines) {
        covFile.uncoveredLines.forEach((line) => {
          newDecorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className: "bg-rose-950/20 border-l-2 border-rose-500/40",
              linesDecorationsClassName: "bg-rose-500/80 w-1",
              overviewRuler: {
                color: "rgba(244, 63, 94, 0.4)",
                position: monaco.editor.OverviewRulerLane.Right,
              },
            },
          });
        });
      }
    }

    try {
      testDecorationIdsRef.current = editor.deltaDecorations(
        testDecorationIdsRef.current,
        newDecorations
      );
    } catch (e) {}
  }, [activeTab, testsHook.testFiles, testsHook.coverageData]);

  // Monaco Slow Line Profiler Highlights
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: any[] = [];
    const activeFileName = activeTab.path.split("/").pop() || "";

    const cpuFunctions = profiler.cpuProfile?.functions || (profiler.jsProfile?.functions as any[]) || [];
    cpuFunctions.forEach((fn: any) => {
      const matchesFile = fn.file === activeTab.path || fn.file === activeFileName || activeTab.path.endsWith(fn.file);
      if (matchesFile && fn.line) {
        newDecorations.push({
          range: new monaco.Range(fn.line, 1, fn.line, 1),
          options: {
            isWholeLine: true,
            className: "bg-amber-950/20 border-l-2 border-amber-500/50",
            linesDecorationsClassName: "bg-amber-500/80 w-1",
            glyphMarginClassName: "bg-amber-500 rounded-full w-2 h-2 ml-1",
            glyphMarginHoverMessage: {
              value: `Hot Path: ${fn.name}() - Total: ${fn.totalTime}ms (Cum: ${fn.cumulativeTime}ms, Calls: ${fn.calls})`,
            },
            overviewRuler: {
              color: "rgba(245, 158, 11, 0.6)",
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        });
      }
    });

    try {
      profilerDecorationIdsRef.current = editor.deltaDecorations(
        profilerDecorationIdsRef.current,
        newDecorations
      );
    } catch (e) {}
  }, [activeTab, profiler.cpuProfile, profiler.jsProfile]);

  const clearProfilerDecorations = () => {
    if (editorRef.current && profilerDecorationIdsRef.current.length > 0) {
      try {
        profilerDecorationIdsRef.current = editorRef.current.deltaDecorations(
          profilerDecorationIdsRef.current,
          []
        );
      } catch (e) {}
    }
  };

  // Monaco Security Findings Highlights
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: any[] = [];
    const activeFileName = activeTab.path.split("/").pop() || "";

    const fileFindings = (securityAudit.findings || []).filter(
      (f) => f.file === activeTab.path || f.file === activeFileName || activeTab.path.endsWith(f.file)
    );

    fileFindings.forEach((f) => {
      if (f.line) {
        const isCritical = f.severity === "critical";
        const isHigh = f.severity === "high";
        const isMedium = f.severity === "medium";

        const glyphColor = isCritical
          ? "bg-red-500 rounded-full w-2 h-2 ml-1"
          : isHigh
          ? "bg-rose-500 rounded-full w-2 h-2 ml-1"
          : isMedium
          ? "bg-amber-500 rounded-full w-2 h-2 ml-1"
          : "bg-blue-500 rounded-full w-2 h-2 ml-1";

        const rulerColor = isCritical
          ? "rgba(239, 68, 68, 0.8)"
          : isHigh
          ? "rgba(244, 63, 94, 0.8)"
          : "rgba(245, 158, 11, 0.8)";

        newDecorations.push({
          range: new monaco.Range(f.line, 1, f.line, 1),
          options: {
            isWholeLine: true,
            className: "bg-red-950/20 border-l-2 border-red-500/50",
            linesDecorationsClassName: "bg-red-500/80 w-1",
            glyphMarginClassName: glyphColor,
            glyphMarginHoverMessage: {
              value: `🛡️ [${f.severity.toUpperCase()}] ${f.title}\n\n💡 Recommendation: ${f.recommendation}`,
            },
            overviewRuler: {
              color: rulerColor,
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        });
      }
    });

    try {
      securityDecorationIdsRef.current = editor.deltaDecorations(
        securityDecorationIdsRef.current,
        newDecorations
      );
    } catch (e) {}
  }, [activeTab, securityAudit.findings]);

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
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = [folder, ...safePrev.filter((f) => f && f !== folder && typeof f === "string")].slice(0, 5);
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
      openTabs: (Array.isArray(openTabs) ? openTabs : []).filter((t) => t && typeof t.path === "string").map((t) => ({ path: t.path, name: t.name })),
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
            runAnalysis(newTab);

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

            if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.calculateLuminance) {
              try {
                const lumRes = await window.electronAPI.calculateLuminance(demo.folderPath);
                if (lumRes && !lumRes.error) {
                  setLuminanceReport(lumRes);
                  setLuminance(lumRes.mean_luminance);
                }
              } catch (e) {}
            }

            if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanStructuralClones) {
              try {
                const cloneRes = await window.electronAPI.scanStructuralClones(demo.folderPath);
                if (Array.isArray(cloneRes)) {
                  setStructuralCloneGroups(cloneRes);
                }
              } catch (e) {}
            }

            if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanSemanticClones) {
              try {
                const semRes = await window.electronAPI.scanSemanticClones(demo.folderPath);
                if (Array.isArray(semRes)) {
                  setSemanticCloneGroups(semRes);
                }
              } catch (e) {}
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
        const parsed = safeParse<any[]>(stored, []);
        if (Array.isArray(parsed)) {
          setRecentWorkspaces(parsed.filter((p) => typeof p === "string"));
        } else {
          setRecentWorkspaces([]);
        }
      } catch (e) {
        setRecentWorkspaces([]);
      }
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
        if (Array.isArray(loadedState.openTabs) && loadedState.openTabs.length > 0) {
          for (const tab of loadedState.openTabs) {
            if (!tab || typeof tab.path !== "string") continue;
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
          runAnalysis(activeTabObj);
        }

        // 4. Background workspace scan & luminance calculation
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

        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.calculateLuminance) {
          try {
            const lumRes = await window.electronAPI.calculateLuminance(loadedState.folderPath);
            if (lumRes && !lumRes.error) {
              setLuminanceReport(lumRes);
              setLuminance(lumRes.mean_luminance);
            }
          } catch (e) {}
        }

        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanStructuralClones) {
          try {
            const cloneRes = await window.electronAPI.scanStructuralClones(loadedState.folderPath);
            if (Array.isArray(cloneRes)) {
              setStructuralCloneGroups(cloneRes);
            }
          } catch (e) {}
        }

        if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanSemanticClones) {
          try {
            const semRes = await window.electronAPI.scanSemanticClones(loadedState.folderPath);
            if (Array.isArray(semRes)) {
              setSemanticCloneGroups(semRes);
            }
          } catch (e) {}
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

  const activeTabPathRef = useRef(activeTabPath);
  activeTabPathRef.current = activeTabPath;

  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Only the most recent active-tab request may update the shared analysis panel.
  // This prevents a slower response from a previously selected tab overwriting it.
  const analysisRequestIdRef = useRef(0);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isCmd && e.shiftKey && key === "f") {
        e.preventDefault();
        setMainView((prev) => (prev === "search" ? "editor" : "search"));
      } else if (e.key === "Escape") {
        if (editorRef.current && searchMatchDecorationIdsRef.current.length > 0) {
          try {
            searchMatchDecorationIdsRef.current = editorRef.current.deltaDecorations(
              searchMatchDecorationIdsRef.current,
              []
            );
          } catch (e) {}
        }
      } else if (isCmd && key === "p") {
        e.preventDefault();
        setSearchModalMode("files");
        setShowSearchModal(true);
      } else if (isCmd && key === "t") {
        e.preventDefault();
        setSearchModalMode("symbols");
        setShowSearchModal(true);
      } else if (isCmd && key === "s") {
        e.preventDefault();
        handleSaveFile();
      } else if (isCmd && key === "w") {
        e.preventDefault();
        const currentActive = openTabsRef.current.find(t => t.path === activeTabPathRef.current);
        if (currentActive) handleCloseTab(currentActive.path);
      } else if (isCmd && key === "k") {
        e.preventDefault();
        setCmdPaletteOpen(true);
      } else if (isCmd && e.shiftKey && key === "i") {
        e.preventDefault();
        setAiPanelMode("agent");
        setAiPanelOpen((prev) => !prev);
      } else if (isCmd && key === "i") {
        if (selectionInfoRef.current && selectionInfoRef.current.text) {
          e.preventDefault();
          handleRunAiCodeAction("explain");
        }
      } else if (isCmd && e.shiftKey && key === "r") {
        if (selectionInfoRef.current && selectionInfoRef.current.text) {
          e.preventDefault();
          handleRunAiCodeAction("refactor");
        }
      } else if (isCmd && e.shiftKey && key === "g") {
        e.preventDefault();
        setMainView((prev) => (prev === "source_control" ? "editor" : "source_control"));
      } else if (isCmd && e.shiftKey && key === "t") {
        e.preventDefault();
        setMainView((prev) => (prev === "test_explorer" ? "editor" : "test_explorer"));
      } else if (isCmd && e.shiftKey && key === "p") {
        e.preventDefault();
        setMainView((prev) => (prev === "profiler" ? "editor" : "profiler"));
      } else if (isCmd && e.shiftKey && key === "s") {
        e.preventDefault();
        setMainView((prev) => (prev === "security_audit" ? "editor" : "security_audit"));
      } else if (e.key === "F7") {
        e.preventDefault();
        if (e.shiftKey) {
          if (activeTabRef.current) {
            profiler.profilePython(activeTabRef.current.content, activeTabRef.current.path);
          }
        } else {
          if (activeTabRef.current) {
            profiler.profilePython(activeTabRef.current.content, activeTabRef.current.path);
            setMainView("profiler");
          }
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        if (e.shiftKey) {
          if (activeTabRef.current) {
            testsHook.runFileTests(activeTabRef.current.path);
          }
        } else {
          if (activeTabRef.current) {
            const fileTests = testsHook.testFiles.find((f) => f.filePath === activeTabRef.current?.path);
            if (fileTests && fileTests.children.length > 0) {
              const first = fileTests.children[0];
              const testCase = first.type === "test" ? first : first.children[0];
              if (testCase) testsHook.runSingleTest(testCase);
            } else {
              testsHook.runFileTests(activeTabRef.current.path);
            }
          }
        }
      } else if (e.key === "F10") {
        e.preventDefault();
        if (debugStepsRef.current.length > 0) {
          if (e.shiftKey) {
            setDebugIndex((idx) => Math.max(0, idx - 1));
          } else {
            setDebugIndex((idx) => Math.min(debugStepsRef.current.length - 1, idx + 1));
          }
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        const currentActive = openTabsRef.current.find(t => t.path === activeTabPathRef.current);
        if (currentActive) runAnalysis(currentActive);
      } else if (isCmd && e.shiftKey && key === "b") {
        e.preventDefault();
        snapshotHook.createSnapshot(
          `Snapshot ${new Date().toLocaleTimeString()}`,
          "Manual snapshot via shortcut",
          openTabsRef.current,
          activeTabPathRef.current
        );
        showToast("Snapshot created successfully");
      } else if (e.key === "Escape") {
        if (debugPanelOpen) {
          setDebugPanelOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Apply Monaco Line Highlights & Luminance Heatmap
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    try {
      const editor = editorRef.current;
      let newDecorations: any[] = [];

      if (activeFileLuminance && activeFileLuminance.statements.length > 0) {
        newDecorations = activeFileLuminance.statements.map((s) => {
          const lum = s.luminance;
          const isDark = lum < 0.25;
          const isMedium = lum >= 0.25 && lum < 0.70;
          const isBright = lum >= 0.70;

          const glyphClass = isDark
            ? "luminance-glyph-dark"
            : isMedium
            ? "luminance-glyph-med"
            : "luminance-glyph-bright";

          const lineClass = isDark
            ? "luminance-line-dark"
            : isMedium
            ? "luminance-line-med"
            : "luminance-line-bright";

          const bgClass = isDark
            ? "luminance-bg-dark"
            : isMedium
            ? "luminance-bg-med"
            : "luminance-bg-bright";

          const scorePct = (lum * 100).toFixed(0);
          const classLabel = isDark ? "Dark Code (Vacuous)" : isMedium ? "Moderate Leverage" : "Bright (High Causal Influence)";

          return {
            range: {
              startLineNumber: s.line,
              startColumn: 1,
              endLineNumber: s.end_line || s.line,
              endColumn: 100,
            },
            options: {
              isWholeLine: true,
              className: bgClass,
              glyphMarginClassName: glyphClass,
              linesDecorationsClassName: lineClass,
              hoverMessage: {
                value: `### Causal Luminance: ${scorePct}% (${lum.toFixed(2)})\n**Classification**: ${classLabel}\n\n**Reason**: ${s.reason || "Statement analysis"}\n\n*Factors*: Data Flow: ${(s.factors?.data_flow ?? 0) * 100}%, Control Flow: ${(s.factors?.control_flow ?? 0) * 100}%, Mutation: ${(s.factors?.mutation ?? 0) * 100}%`,
              },
            },
          };
        });
      } else {
        newDecorations = findings.map((f) => ({
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
      }

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    } catch (err) {
      console.error("[IDE-APP] Error applying line decorations:", err);
    }
  }, [findings, activeTabPath, activeTab?.content, activeFileLuminance]);

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
            // A scan updates project findings only. It must never replace the
            // user's active editor tab when its asynchronous result arrives.
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
  const handleOpenFile = async (file: FileNode | any) => {
    console.log("[OPEN-FILE] received:", file);
    console.log("[OPEN-FILE] typeof:", typeof file);

    if (!file) {
      console.log("[OPEN-FILE] Invalid file payload");
      return;
    }

    if (typeof file === "object" && file.isDirectory) return;

    let targetPath = "";
    if (typeof file === "string") {
      targetPath = file;
    } else if (typeof file === "object" && file !== null) {
      targetPath = file.path || file.absolute_path || file.file_path || file.file || file.relativePath || "";
    }

    const filePath = typeof targetPath === "string" ? targetPath.trim() : "";
    console.log("[OPEN-FILE] path:", filePath);

    if (!filePath) {
      console.error("[OPEN-FILE] Missing file path:", file);
      return;
    }

    let targetName = "";
    if (typeof file === "object" && file !== null) {
      targetName = file.name || file.filename || "";
    }
    if (!targetName && filePath) {
      targetName = filePath.split("/").pop() || "file.py";
    }
    const fileName = targetName || "file.py";
    console.log("[OPEN-FILE] name:", fileName);

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

    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      restoreTabCursor(filePath);
      runAnalysis(existing);
      return;
    }

    addLog(`[FS] Reading file from disk: ${fileName}`);
    let content = defaultCartCalculatorCode;
    if (typeof window !== "undefined" && window.electronAPI && typeof filePath === "string") {
      try {
        console.log('[IDE-APP] handleOpenFile invoking readFile for', filePath);
        const res = await window.electronAPI.readFile(filePath);
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
      path: filePath,
      name: fileName,
      content,
      savedContent: content,
      isDirty: false,
    };
    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabPath(filePath);
    restoreTabCursor(filePath);
    runAnalysis(newTab);
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

  const handleSelectSearchMatch = async (match: SearchMatchItem, index: number) => {
    search.setSelectedResultIndex(index);
    const targetFile = match.fullPath || (folderPath ? `${folderPath}/${match.file}` : match.file);
    const fileName = match.file.split("/").pop() || match.file;

    // Open or switch to tab
    await handleOpenFile({ name: fileName, path: targetFile, isDirectory: false });

    // Jump to line in Monaco editor
    setTimeout(() => {
      if (editorRef.current && monacoRef.current) {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        editor.revealLineInCenter(match.line);
        editor.setPosition({ lineNumber: match.line, column: match.column });
        editor.focus();

        try {
          const decorations = [
            {
              range: new monaco.Range(match.line, match.column, match.line, match.column + match.matchText.length),
              options: {
                className: "bg-amber-400/50 text-black font-bold border-b-2 border-amber-400",
                isWholeLine: false,
              },
            },
          ];
          searchMatchDecorationIdsRef.current = editor.deltaDecorations(
            searchMatchDecorationIdsRef.current,
            decorations
          );
        } catch (e) {}
      }
    }, 100);
  };

  const handleOpenTestFile = async (filePath: string, line?: number) => {
    if (!filePath) return;
    const name = filePath.split("/").pop() || filePath;
    await handleOpenFile({ name, path: filePath, isDirectory: false });
    if (line && editorRef.current) {
      setTimeout(() => {
        try {
          editorRef.current.setPosition({ lineNumber: line, column: 1 });
          editorRef.current.revealLineInCenter(line);
          editorRef.current.focus();
        } catch (e) {}
      }, 100);
    }
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
    if (activeTabPath && typeof window !== "undefined" && (window as any).electronAPI?.updateBDGFile) {
      (window as any).electronAPI.updateBDGFile(activeTabPath, val);
    }
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
      runAnalysis(nextTab);
    }
  };

  const handleSaveFile = async () => {
    if (!activeTab || !activeTab.path) return;
    addLog(`[FS] Saving file: ${activeTab.name}`);

    if (typeof window !== "undefined" && window.electronAPI && typeof activeTab.path === "string") {
      try {
        console.log('[IDE-APP] handleSaveFile invoking writeFile for', activeTab.path);
        const res = await window.electronAPI.writeFile(activeTab.path, activeTab.content);
        if (res.success) {
          setOpenTabs((prev) => {
            const nextTabs = prev.map((t) =>
              t.path === activeTab.path
                ? { ...t, savedContent: t.content, isDirty: false }
                : t
            );
            const remainingDirty = nextTabs.filter((t) => t.isDirty);
            if (remainingDirty.length === 0 && folderPath) {
              flushRecoverySnapshot();
            }
            return nextTabs;
          });
          showToast(`Saved ${activeTab.name}`);
          addLog(`[FS] File saved successfully to disk.`);
          git.refreshStatus(folderPath || "");
        } else {
          addLog(`[ERROR] Save failed: ${res.error}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error saving file:", err);
      }
    } else {
      setOpenTabs((prev) => {
        const nextTabs = prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, savedContent: t.content, isDirty: false }
            : t
        );
        const remainingDirty = nextTabs.filter((t) => t.isDirty);
        if (remainingDirty.length === 0 && folderPath) {
          flushRecoverySnapshot();
        }
        return nextTabs;
      });
      showToast(`Saved ${activeTab.name}`);
      addLog(`[FS] Saved ${activeTab.name} (Mock).`);
    }
  };

  const runAnalysis = async (tab: TabItem) => {
    if (!tab?.path) return;
    const { path, content } = tab;
    const requestId = ++analysisRequestIdRef.current;
    setAnalyzing(true);
    setAnalysisError(null);
    addLog(`[ENGINE] Running Python analyzer on ${path}...`);
    const bytes = new TextEncoder().encode(content).length;
    console.log(`[RENDERER] Analyze path=${path} bytes=${bytes}`);

    try {
      if (typeof window === "undefined" || !window.electronAPI?.analyzeFile) {
        throw new Error("Electron analysis bridge is unavailable.");
      }
      const res = await window.electronAPI.analyzeFile({ filePath: path, content });
      if (!res || res.error) throw new Error(res?.error || "Analyzer returned no result.");
      if (!Array.isArray(res.findings)) throw new Error("Analyzer returned an invalid findings payload.");
      if (requestId !== analysisRequestIdRef.current) return;

      setFindings(res.findings);
      setLuminance(res.causal_luminance !== undefined ? res.causal_luminance : (res.findings.length > 0 ? 0.0 : 1.0));
      addLog(`[ENGINE] Analysis complete: ${res.findings.length} ghost lines detected.`);
    } catch (err: any) {
      if (requestId !== analysisRequestIdRef.current) return;
      const message = err?.message || String(err);
      console.error("[RENDERER] Analysis failed:", message);
      setFindings([]);
      setLuminance(1.0);
      setAnalysisError(message);
      addLog(`[ENGINE] Analysis failed: ${message}`);
    } finally {
      if (requestId === analysisRequestIdRef.current) setAnalyzing(false);
    }
  };

  const handleRunWorkspaceScan = async () => {
    if (!folderPath) return;

    setWorkspaceLoading(true);
    setWorkspaceScanLoading(true);
    console.log('[WORKSPACE] scan start', folderPath);
    addLog(`[SCAN] Starting workspace-wide AST tomography on ${folderPath}...`);

    if (typeof window !== "undefined" && window.electronAPI && typeof folderPath === "string" && !folderPath.startsWith("demo-workspaces/")) {
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

  const handleSelectSearchResult = async (result: SearchResultItem) => {
    const targetPath = result.absolute_path || (folderPath ? `${folderPath}/${result.file}` : result.file);
    const fileName = result.filename || result.file.split("/").pop() || "file.py";

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setTimeout(() => {
      if (editorRef.current && result.line > 0) {
        try {
          editorRef.current.revealLineInCenter(result.line);
          editorRef.current.setPosition({
            lineNumber: result.line,
            column: result.column || 1,
          });
          editorRef.current.focus();
          setCursorPos({ line: result.line, col: result.column || 1 });
        } catch (e) {}
      }
    }, 150);

    showToast(`Navigated to ${fileName}:${result.line}`);
    addLog(`[NAV] Jumped to ${result.file}:${result.line}:${result.column} (${result.match_type})`);
    console.log('[NAV] Jumped to', result.file, 'at line', result.line);
  };

  const handleScanStructuralClones = async () => {
    if (!folderPath) return;
    setStructuralCloneLoading(true);
    addLog(`[CLONE] Scanning for structural AST clones in: ${folderPath}...`);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanStructuralClones) {
      try {
        const groups = await window.electronAPI.scanStructuralClones(folderPath);
        if (Array.isArray(groups)) {
          setStructuralCloneGroups(groups);
          setRightPanelTab("clones");
          showToast(`Structural clone scan complete · ${groups.length} clone groups`);
          addLog(`[CLONE] Structural clone scan complete · ${groups.length} clone groups`);
          console.log(`[CLONE] Structural clone scan complete · ${groups.length} clone groups`, groups);
        }
      } catch (err: any) {
        console.error("[CLONE] Structural clone scan error:", err);
        addLog(`[CLONE] Error: ${err.message || String(err)}`);
      } finally {
        setStructuralCloneLoading(false);
      }
    } else {
      setStructuralCloneLoading(false);
    }
  };

  const handleScanSemanticClones = async () => {
    if (!folderPath) return;
    setSemanticCloneScanLoading(true);
    addLog(`[SEMANTIC] Scanning for semantic AST clones in: ${folderPath}...`);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.scanSemanticClones) {
      try {
        const groups = await window.electronAPI.scanSemanticClones(folderPath);
        if (Array.isArray(groups)) {
          setSemanticCloneGroups(groups);
          setRightPanelTab("semantic");
          showToast(`Semantic clone scan complete · ${groups.length} clone groups`);
          addLog(`[SEMANTIC] Semantic clone scan complete · ${groups.length} clone groups`);
          console.log(`[SEMANTIC] Semantic clone scan complete · ${groups.length} clone groups`, groups);
        }
      } catch (err: any) {
        console.error("[SEMANTIC] Semantic clone scan error:", err);
        addLog(`[SEMANTIC] Error: ${err.message || String(err)}`);
      } finally {
        setSemanticCloneScanLoading(false);
      }
    } else {
      setSemanticCloneScanLoading(false);
    }
  };

  const handleOpenCloneOccurrence = async (occ: StructuralCloneOccurrence) => {
    const targetPath = occ.absolute_path || (folderPath ? `${folderPath}/${occ.file}` : occ.file);
    const fileName = occ.file.split("/").pop() || "file.py";

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setMainView("editor");

    setTimeout(() => {
      if (editorRef.current && occ.start_line > 0) {
        try {
          editorRef.current.revealLineInCenter(occ.start_line);
          editorRef.current.setPosition({
            lineNumber: occ.start_line,
            column: 1,
          });
          editorRef.current.focus();
          setCursorPos({ line: occ.start_line, col: 1 });
        } catch (e) {}
      }
    }, 100);
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

    const cloneItems = structuralCloneGroups.length > 0
      ? structuralCloneGroups.map((g, idx) => ({
          group_id: `CLONE-GRP-${idx + 1}: ${g.fingerprint.length > 30 ? g.fingerprint.slice(0, 27) + "..." : g.fingerprint}`,
          similarity: 1.0,
          similarity_label: "100% STRUCTURAL MATCH",
          clone_type: "structural_ast",
          files: Array.from(new Set(g.occurrences.map((o) => o.file))),
          instances_count: g.occurrences.length,
          instances: g.occurrences.map((i) => ({
            file: i.file,
            start_line: i.start_line,
            end_line: i.end_line,
            code: i.code,
          })),
        }))
      : cloneReport?.groups?.map((g) => ({
          group_id: g.group_id,
          similarity: g.similarity,
          similarity_label: g.similarity_label,
          clone_type: g.clone_type,
          files: g.files,
          instances_count: g.instances_count,
          instances: g.instances.map((i) => ({
            file: i.file,
            start_line: i.start_line,
            end_line: i.end_line,
            code: i.code,
          })),
        }));

    const payload: ReportExportPayload & { clone_groups_count?: number; clone_occurrences_count?: number; clone_groups?: any[] } = {
      workspacePath: folderPath,
      timestamp: new Date().toLocaleString(),
      metrics,
      clone_groups_count: structuralCloneGroups.length || (cloneReport?.groups?.length ?? 0),
      clone_occurrences_count: structuralCloneGroups.reduce((acc, g) => acc + g.occurrences.length, 0) || (cloneReport?.total_clones ?? 0),
      clone_groups: structuralCloneGroups.length > 0 ? structuralCloneGroups : (cloneReport?.groups ?? []),
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
      clones: cloneItems,
      semanticClones: semanticCloneGroups.length > 0
        ? semanticCloneGroups.map((g, idx) => ({
            group_id: `SEM-GRP-${idx + 1}`,
            semantic_pattern: g.fingerprint.length > 35 ? g.fingerprint.slice(0, 32) + "..." : g.fingerprint,
            similarity: g.confidence,
            similarity_label: `${Math.round(g.confidence * 100)}% CONFIDENCE`,
            files: Array.from(new Set(g.occurrences.map((o) => o.file))),
            instances_count: g.occurrences.length,
            instances: g.occurrences.map((i) => ({
              file: i.file,
              start_line: i.start_line,
              end_line: i.end_line,
              code: i.code,
              implementation_style: "canonical_ast_reduction",
            })),
          }))
        : semanticCloneReport?.groups?.map((g) => ({
            group_id: g.group_id,
            semantic_pattern: g.semantic_pattern,
            similarity: g.similarity,
            similarity_label: g.similarity_label,
            files: g.files,
            instances_count: g.instances_count,
            instances: g.instances.map((i) => ({
              file: i.file,
              start_line: i.start_line,
              end_line: i.end_line,
              code: i.code,
              implementation_style: i.implementation_style,
            })),
          })),
      luminanceReport: luminanceReport ? {
        mean_luminance: luminanceReport.mean_luminance,
        median_luminance: luminanceReport.median_luminance,
        dark_code_ratio: luminanceReport.dark_code_ratio,
        bright_code_ratio: luminanceReport.bright_code_ratio,
        causal_entropy_index: luminanceReport.causal_entropy_index,
        histogram: luminanceReport.histogram,
        darkest_statements: luminanceReport.darkest_statements,
      } : null,
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

    if (typeof window !== "undefined" && window.electronAPI && typeof folder === "string" && !folder.startsWith("demo-workspaces/")) {
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

  const handleRunCloneScan = async () => {
    const ws = folderPath || ".";
    setCloneLoading(true);
    setMainView("clones");
    addLog(`[CLONES] Initiating AST Structural Clone detection for: ${ws}`);
    console.log('[CLONES] run scan for', ws);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.detectClones) {
      try {
        const result = await window.electronAPI.detectClones(ws);
        setCloneReport(result);
        addLog(`[CLONES] Detection complete. Found ${result.total_clone_groups} clone groups (${result.total_clones} instances) across ${result.total_files} files.`);
        console.log('[CLONES] result groups count:', result.total_clone_groups);
      } catch (err: any) {
        addLog(`[CLONES] Error during clone scan: ${err.message || String(err)}`);
      }
    } else {
      // Browser fallback simulation
      const fallbackReport: CloneReport = {
        workspace: ws,
        total_files: 3,
        total_clone_groups: 2,
        total_clones: 4,
        groups: [
          {
            group_id: "clone-group-1",
            similarity: 1.0,
            similarity_label: "100% Structural AST Match",
            clone_type: "statement_block",
            signature: "Assign(targets=[Name(id='VAR_1', ctx=Store())], value=BinOp(left=Name(id='VAR_2', ctx=Load()), op=Mult(), right=Constant(value=0)))",
            signature_hash: "d2250956da6540d9",
            files_count: 1,
            files: ["src/cart_calculator.py"],
            instances_count: 2,
            instances: [
              {
                type: "statement_block",
                name: "L16-16",
                file: "src/cart_calculator.py",
                absolute_path: `${ws}/src/cart_calculator.py`,
                start_line: 16,
                end_line: 16,
                code: "discount_amount = subtotal * 0.10",
              },
              {
                type: "statement_block",
                name: "L18-18",
                file: "src/cart_calculator.py",
                absolute_path: `${ws}/src/cart_calculator.py`,
                start_line: 18,
                end_line: 18,
                code: "discount_amount = subtotal * 0.20",
              },
            ],
          },
          {
            group_id: "clone-group-2",
            similarity: 1.0,
            similarity_label: "100% Structural AST Match",
            clone_type: "statement_block",
            signature: "Assign(targets=[Name(id='VAR_1', ctx=Store())], value=Constant(value='STR'))",
            signature_hash: "7b14c4fea706aadd",
            files_count: 1,
            files: ["src/checkout_engine.py"],
            instances_count: 2,
            instances: [
              {
                type: "statement_block",
                name: "L6-6",
                file: "src/checkout_engine.py",
                absolute_path: `${ws}/src/checkout_engine.py`,
                start_line: 6,
                end_line: 6,
                code: "order_status = \"PENDING_PAYMENT\"",
              },
              {
                type: "statement_block",
                name: "L10-10",
                file: "src/checkout_engine.py",
                absolute_path: `${ws}/src/checkout_engine.py`,
                start_line: 10,
                end_line: 10,
                code: "order_status = \"CONFIRMED\"",
              },
            ],
          },
        ],
      };
      setCloneReport(fallbackReport);
      addLog(`[CLONES] Simulation complete. Found ${fallbackReport.total_clone_groups} clone groups.`);
    }

    setCloneLoading(false);
  };

  const handleSelectCloneInstance = async (instance: CloneInstance) => {
    console.log('[CLONES] selecting instance', instance.file, instance.start_line);
    addLog(`[CLONES] Opening ${instance.file} at line ${instance.start_line}...`);

    const targetPath = instance.absolute_path || (folderPath ? `${folderPath}/${instance.file}` : instance.file);
    const fileName = instance.file.split("/").pop() || instance.file;

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setMainView("editor");

    setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.revealLineInCenter(instance.start_line);
          editorRef.current.setPosition({ lineNumber: instance.start_line, column: 1 });
          editorRef.current.focus();
        } catch (e) {}
      }
    }, 150);
  };

  const handleRunSemanticCloneScan = async () => {
    const ws = folderPath || ".";
    setSemanticCloneLoading(true);
    setMainView("semantic_clones");
    addLog(`[SEMANTIC-CLONES] Initiating Behavioral Semantic Clone detection for: ${ws}`);
    console.log('[SEMANTIC-CLONES] run scan for', ws);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.detectSemanticClones) {
      try {
        const result = await window.electronAPI.detectSemanticClones(ws);
        setSemanticCloneReport(result);
        addLog(`[SEMANTIC-CLONES] Detection complete. Found ${result.total_groups} semantic clone groups (${result.total_clones} isomorphic blocks) across ${result.total_files} files.`);
        console.log('[SEMANTIC-CLONES] result groups count:', result.total_groups);
      } catch (err: any) {
        addLog(`[SEMANTIC-CLONES] Error during scan: ${err.message || String(err)}`);
      }
    } else {
      // Browser fallback simulation
      const fallbackReport: SemanticCloneReport = {
        workspace: ws,
        threshold: 0.82,
        total_files: 3,
        total_groups: 2,
        total_clones: 4,
        groups: [
          {
            group_id: "semantic-clone-1",
            semantic_pattern: "Sum / Aggregation Reduction",
            semantic_role: "SUM_REDUCTION",
            similarity: 0.93,
            similarity_label: "93% Semantic Match",
            files_count: 2,
            files: ["src/cart_calculator.py", "src/checkout_engine.py"],
            instances_count: 2,
            fingerprint: {
              role: "SUM_REDUCTION",
              target_aggregation: "SUM",
              data_flow: "iterable_to_scalar",
            },
            instances: [
              {
                id: "src/cart_calculator.py::L6::sum_builtin",
                file: "src/cart_calculator.py",
                absolute_path: `${ws}/src/cart_calculator.py`,
                start_line: 6,
                end_line: 6,
                code: "subtotal = sum(item[\"price\"] * item[\"quantity\"] for item in items)",
                semantic_role: "SUM_REDUCTION",
                pattern_name: "Sum / Aggregation Reduction",
                implementation_style: "Built-in sum() Aggregator",
                features: {
                  agg_type: "SUM",
                  has_loop: false,
                  has_call: true,
                  data_flow: "iterable_to_scalar",
                  ops: ["sum", "mult", "add"],
                },
              },
              {
                id: "src/checkout_engine.py::L24::loop_sum",
                file: "src/checkout_engine.py",
                absolute_path: `${ws}/src/checkout_engine.py`,
                start_line: 24,
                end_line: 25,
                code: "for item in items:\n        total += item[\"price\"] * item[\"quantity\"]",
                semantic_role: "SUM_REDUCTION",
                pattern_name: "Sum / Aggregation Reduction",
                implementation_style: "Imperative Loop Accumulator",
                features: {
                  agg_type: "SUM",
                  has_loop: true,
                  has_call: false,
                  data_flow: "iterable_to_scalar",
                  ops: ["loop", "add", "accumulate"],
                },
              },
            ],
          },
          {
            group_id: "semantic-clone-2",
            semantic_pattern: "Max / Boundary Reduction",
            semantic_role: "EXTREMUM_REDUCTION",
            similarity: 0.94,
            similarity_label: "94% Semantic Match",
            files_count: 2,
            files: ["src/cart_calculator.py", "src/invoice_processor.py"],
            instances_count: 2,
            fingerprint: {
              role: "EXTREMUM_REDUCTION",
              target_aggregation: "MAX",
              data_flow: "iterable_to_scalar",
            },
            instances: [
              {
                id: "src/cart_calculator.py::L20::max_builtin",
                file: "src/cart_calculator.py",
                absolute_path: `${ws}/src/cart_calculator.py`,
                start_line: 20,
                end_line: 20,
                code: "taxable_amount = max(0.0, subtotal - discount_amount)",
                semantic_role: "EXTREMUM_REDUCTION",
                pattern_name: "Max / Boundary Reduction",
                implementation_style: "Built-in max() Aggregator",
                features: {
                  agg_type: "MAX",
                  has_loop: false,
                  has_call: true,
                  data_flow: "iterable_to_scalar",
                  ops: ["max", "compare"],
                },
              },
              {
                id: "src/invoice_processor.py::L20::loop_max",
                file: "src/invoice_processor.py",
                absolute_path: `${ws}/src/invoice_processor.py`,
                start_line: 20,
                end_line: 22,
                code: "for item in items:\n        if item[\"price\"] > highest:\n            highest = item[\"price\"]",
                semantic_role: "EXTREMUM_REDUCTION",
                pattern_name: "Max / Boundary Reduction",
                implementation_style: "Imperative Iterative Extremum Search",
                features: {
                  agg_type: "MAX",
                  has_loop: true,
                  has_call: false,
                  data_flow: "iterable_to_scalar",
                  ops: ["loop", "compare", "update"],
                },
              },
            ],
          },
        ],
      };
      setSemanticCloneReport(fallbackReport);
      addLog(`[SEMANTIC-CLONES] Simulation complete. Found ${fallbackReport.total_groups} semantic clone groups.`);
    }

    setSemanticCloneLoading(false);
  };

  const handleSelectSemanticCloneInstance = async (instance: SemanticCloneInstance) => {
    console.log('[SEMANTIC-CLONES] selecting instance', instance.file, instance.start_line);
    addLog(`[SEMANTIC-CLONES] Opening ${instance.file} at line ${instance.start_line}...`);

    const targetPath = instance.absolute_path || (folderPath ? `${folderPath}/${instance.file}` : instance.file);
    const fileName = instance.file.split("/").pop() || instance.file;

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setMainView("editor");

    setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.revealLineInCenter(instance.start_line);
          editorRef.current.setPosition({ lineNumber: instance.start_line, column: 1 });
          editorRef.current.focus();
        } catch (e) {}
      }
    }, 150);
  };

  const handleRunLuminanceScan = async () => {
    const ws = folderPath || "demo-workspaces/ai_cart_project";
    setLuminanceLoading(true);
    addLog(`[LUMINANCE] Computing Causal Luminance and Entropy scores for: ${ws}`);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.calculateLuminance) {
      try {
        const rep = await window.electronAPI.calculateLuminance(ws);
        if (rep && !rep.error) {
          setLuminanceReport(rep);
          setLuminance(rep.mean_luminance);
          addLog(`[LUMINANCE] Scoring complete. Mean: ${(rep.mean_luminance * 100).toFixed(0)}%, Dark Ratio: ${(rep.dark_code_ratio * 100).toFixed(1)}%, Entropy: ${rep.causal_entropy_index}.`);
        } else {
          addLog(`[LUMINANCE] Engine error: ${rep?.error || "Unknown error"}`);
        }
      } catch (err: any) {
        addLog(`[LUMINANCE] Exception: ${err.message || String(err)}`);
      }
    }
    setLuminanceLoading(false);
  };

  const handleGenerateFingerprint = async (targetFilePath?: string) => {
    const fpath = targetFilePath || activeTabPath || "demo-workspaces/ai_cart_project/src/cart_calculator.py";
    setFingerprintLoading(true);
    addLog(`[BEHAVIOR-FINGERPRINT] Discovering functions and executing input matrix for: ${fpath}`);

    if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).generateFingerprint) {
      try {
        const rep = await (window.electronAPI as any).generateFingerprint(fpath);
        if (rep && !rep.error) {
          setFingerprintReport(rep);
          addLog(`[BEHAVIOR-FINGERPRINT] Complete. Discovered ${rep.functions_count || 0} functions.`);
        } else {
          addLog(`[BEHAVIOR-FINGERPRINT] Error: ${rep?.error || "Unknown error"}`);
        }
      } catch (err: any) {
        addLog(`[BEHAVIOR-FINGERPRINT] Exception: ${err.message || String(err)}`);
      }
    }
    setFingerprintLoading(false);
  };

  const handleRunBlastRadius = async (editedSource: string) => {
    const fpath = activeTabPath || "demo-workspaces/ai_cart_project/src/cart_calculator.py";
    addLog(`[BEHAVIOR-BLAST-RADIUS] Computing blast radius for edited source in: ${fpath}`);
    if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).calculateBlastRadius) {
      try {
        const res = await (window.electronAPI as any).calculateBlastRadius({
          original_path: fpath,
          edited_source: editedSource,
          workspace_graph: workspaceGraph,
          max_depth: 3,
        });
        if (res && !res.error) {
          setBlastRadiusResult(res);
          addLog(`[BEHAVIOR-BLAST-RADIUS] Complete. Blast radius score: ${res.blast_radius_score || 0.0}`);
        } else if (res?.error) {
          addLog(`[BEHAVIOR-BLAST-RADIUS] Error: ${res.error}`);
        }
        return res;
      } catch (err: any) {
        addLog(`[BEHAVIOR-BLAST-RADIUS] Exception: ${err.message || String(err)}`);
      }
    }
    return null;
  };

  const handleRunCounterfactual = async (candidateLine: string) => {
    const fpath = activeTabPath || "demo-workspaces/ai_cart_project/src/cart_calculator.py";
    addLog(`[COUNTERFACTUAL] Computing counterfactual execution world for line(s) '${candidateLine}' in: ${fpath}`);
    if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).runCounterfactualAnalysis) {
      try {
        const res = await (window.electronAPI as any).runCounterfactualAnalysis({
          original_path: fpath,
          candidate_line: candidateLine,
          workspace_graph: workspaceGraph,
        });
        if (res && !res.error) {
          setCounterfactualResult(res);
          addLog(`[COUNTERFACTUAL] Analysis complete. Equivalence score: ${Math.round((res.equivalence_score || 0) * 100)}%, Safe: ${res.safe_to_remove}`);
        } else if (res?.error) {
          addLog(`[COUNTERFACTUAL] Error: ${res.error}`);
        }
        return res;
      } catch (err: any) {
        addLog(`[COUNTERFACTUAL] Exception: ${err.message || String(err)}`);
      }
    }
    return null;
  };

  const handleEvaluatePatchFirewall = async (patchText: string) => {
    const fpath = activeTabPath || "demo-workspaces/ai_cart_project/src/cart_calculator.py";
    addLog(`[PATCH-FIREWALL] Evaluating AI patch safety for: ${fpath}`);
    setPatchFirewallLoading(true);
    if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).evaluatePatchFirewall) {
      try {
        const res = await (window.electronAPI as any).evaluatePatchFirewall({
          patch_text: patchText,
          file_path: fpath,
          workspace_graph: workspaceGraph,
          max_depth: 3,
        });
        if (res && !res.error) {
          setPatchFirewallReport(res);
          addLog(`[PATCH-FIREWALL] Evaluation complete. Risk score: ${res.risk_score}/100, Level: ${res.risk_level}, Auto-apply: ${res.safe_to_auto_apply}`);
        } else if (res?.error) {
          addLog(`[PATCH-FIREWALL] Error: ${res.error}`);
        }
      } catch (err: any) {
        addLog(`[PATCH-FIREWALL] Exception: ${err.message || String(err)}`);
      }
    }
    setPatchFirewallLoading(false);
  };

  const handleEvaluateRepositoryFirewall = async (patchText: string) => {
    const repoPath = folderPath || process.cwd();
    addLog(`[REPO-FIREWALL] Evaluating repository-scale PR patch across files in: ${repoPath}`);
    setRepositoryFirewallLoading(true);
    if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).evaluateRepositoryFirewall) {
      try {
        const res = await (window.electronAPI as any).evaluateRepositoryFirewall({
          patch_text: patchText,
          repository_path: repoPath,
          workspace_graph: workspaceGraph,
          max_depth: 3,
        });
        if (res && !res.error) {
          setRepositoryFirewallReport(res);
          addLog(`[REPO-FIREWALL] Evaluation complete. Recommendation: ${res.merge_recommendation}, Risk Score: ${res.risk_score}/100, Files: ${res.files_analyzed}`);
        } else if (res?.error) {
          addLog(`[REPO-FIREWALL] Error: ${res.error}`);
        }
      } catch (err: any) {
        addLog(`[REPO-FIREWALL] Exception: ${err.message || String(err)}`);
      }
    }
    setRepositoryFirewallLoading(false);
  };

  const handleJumpToStatement = async (file: string, line: number) => {
    const targetPath = folderPath ? `${folderPath}/${file}` : file;
    const fileName = file.split("/").pop() || file;

    await handleOpenFile({
      name: fileName,
      path: targetPath,
      isDirectory: false,
    });

    setMainView("editor");

    setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.revealLineInCenter(line);
          editorRef.current.setPosition({ lineNumber: line, column: 1 });
          editorRef.current.focus();
        } catch (e) {}
      }
    }, 150);
  };

  const runDifferentialVerification = async (filePath: string, transformedContent: string) => {
    setVerifying(true);
    addLog(`[VERIFY] Running isolated differential verification for ${filePath}...`);

    if (typeof window !== "undefined" && window.electronAPI && typeof filePath === "string" && !filePath.startsWith("demo-workspaces/")) {
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

  const handleOpenDiffPreview = async (targetFinding?: any) => {
    if (!activeTab) return;
    const linesToPreview = targetFinding ? [targetFinding.line] : findings.map((f) => f.line);
    if (linesToPreview.length === 0) return;

    addLog(`[SURGERY] Preparing diff preview for ${activeTab.name} (${linesToPreview.length} target lines)...`);

    let targetTransformed = "";

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.previewSurgery) {
      try {
        const res = await window.electronAPI.previewSurgery({
          file: activeTab.path,
          approved_lines: linesToPreview,
        });
        if (res && res.success) {
          targetTransformed = res.transformed_source;
          setDiffData({
            file: res.file,
            original_source: res.original_source,
            transformed_source: res.transformed_source,
            changed_lines: res.approved_lines || linesToPreview,
            ghost_count_before: findings.length,
            ghost_count_after: Math.max(0, findings.length - linesToPreview.length),
            causal_luminance_after: 1.0,
          });
        }
      } catch (err) {
        console.error("[SURGERY] Error fetching diff preview:", err);
      }
    } else {
      const original = activeTab.content || "";
      const lines = original.split("\n");
      const approvedSet = new Set(linesToPreview);
      targetTransformed = lines.filter((_, idx) => !approvedSet.has(idx + 1)).join("\n");
      setDiffData({
        file: activeTab.path,
        original_source: original,
        transformed_source: targetTransformed,
        changed_lines: linesToPreview,
        ghost_count_before: findings.length,
        ghost_count_after: Math.max(0, findings.length - linesToPreview.length),
        causal_luminance_after: 1.0,
      });
    }

    setDiffDrawerOpen(true);
    setShowSurgeryDiffModal(true);

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.verifySurgery) {
      setBehaviorVerifying(true);
      addLog("[SURGERY] Running behavioral verification...");
      try {
        const bRes = await window.electronAPI.verifySurgery({
          original_path: activeTab.path,
          transformed_source: targetTransformed,
        });
        setBehaviorResult(bRes);
        if (bRes && bRes.behavior_preserved) {
          addLog("[SURGERY] Behavior preserved.");
        } else if (bRes) {
          const diffMsg = bRes.differences && bRes.differences.length > 0 ? bRes.differences[0] : "stdout mismatch";
          addLog(`[SURGERY] Behavior changed: ${diffMsg}.`);
        }
      } catch (e) {
        console.error("[SURGERY] Verification failed:", e);
      } finally {
        setBehaviorVerifying(false);
      }
    } else {
      setBehaviorResult({
        behavior_preserved: true,
        original: { stdout: "", stderr: "", exit_code: 0, exception: null },
        transformed: { stdout: "", stderr: "", exit_code: 0, exception: null },
        differences: []
      });
    }
  };

  const handleAgentPreviewDiff = () => {
    void handleOpenDiffPreview();
  };

  const handleApplySurgery = async ({
    filePath,
    approvedLines,
    originalSource,
    transformedSource,
  }: SurgeryApplyRequest) => {
    const targetTab = openTabs.find((tab) => tab.path === filePath);
    if (!activeTab || !targetTab || activeTab.path !== filePath || approvedLines.length === 0) {
      showToast("Surgery cancelled: preview no longer matches the active file.");
      addLog("[ERROR] Surgery apply cancelled: preview target no longer matches active tab.");
      return;
    }

    if (targetTab.content !== originalSource) {
      showToast("Surgery cancelled: file changed since preview.");
      addLog(`[ERROR] Surgery apply cancelled: ${targetTab.name} changed since preview.`);
      return;
    }

    // 1. Auto-save dirty file before surgery
    setApplyingSurgery(true);
    addLog(`[SURGERY] Applying surgery to ${targetTab.name} (${approvedLines.length} approved lines)...`);
    if (targetTab.isDirty) {
      await handleSaveFile();
    }

    let success = false;
    let transformedContent = "";
    let backupPath = "";
    const isPython = /\.pyw?$/i.test(filePath);

    if (typeof window !== "undefined" && window.electronAPI && isPython && window.electronAPI.applySurgery) {
      try {
        const res = await window.electronAPI.applySurgery({
          file: filePath,
          approved_lines: approvedLines,
        });

        if (res && res.success) {
          success = true;
          transformedContent = res.transformed_content;
          backupPath = res.backup_path;
          showToast(`Removed ${res.removed_count} ghost ${res.removed_count === 1 ? "line" : "lines"}`);
          addLog(`[SURGERY] Applied surgery to ${targetTab.name}: removed ${res.removed_count} ghost lines. Backup created at ${backupPath}`);
          console.log('[SURGERY] Applied surgery to', targetTab.name, 'removed', res.removed_count, 'lines');
        } else {
          showToast(`Surgery failed: ${res?.error || "Unknown error"}`);
          addLog(`[ERROR] Surgery apply failed: ${res?.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error applying surgery:", err);
        showToast(`Surgery error: ${err}`);
      }
    } else if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.applySafeRemove) {
      try {
        // JavaScript previews are already generated by the JS analyzer. Applying
        // the captured preview avoids sending JavaScript through the Python AST
        // surgery engine and guarantees the preview's file is the only file written.
        const res = await window.electronAPI.applySafeRemove(filePath, transformedSource);
        if (res && res.success) {
          success = true;
          transformedContent = res.transformedContent || transformedSource;
          backupPath = res.backupPath;
          showToast(`Removed ${approvedLines.length} ghost ${approvedLines.length === 1 ? "line" : "lines"}`);
          addLog(`[SURGERY] Applied surgery to ${targetTab.name}: removed ${approvedLines.length} ghost lines. Backup created at ${backupPath}`);
        } else {
          showToast(`Surgery failed: ${res?.error || "Unknown error"}`);
          addLog(`[ERROR] Surgery apply failed: ${res?.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error applying previewed surgery:", err);
        showToast(`Surgery error: ${err}`);
      }
    } else {
      // Fallback for mock/browser testing
      transformedContent = transformedSource;
      success = true;
      showToast(`Removed ${approvedLines.length} ghost ${approvedLines.length === 1 ? "line" : "lines"}`);
    }

    if (success) {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === filePath
            ? { ...t, content: transformedContent, savedContent: transformedContent, isDirty: false }
            : t
        )
      );
      setUndoAvailableForFile((prev) => ({ ...prev, [filePath]: true }));
      setDiffDrawerOpen(false);
      setShowSurgeryDiffModal(false);

      // 1. Rerun single-file AST analysis
      runAnalysis({ ...targetTab, content: transformedContent, savedContent: transformedContent, isDirty: false });

      // 2. Refresh workspace dashboard, luminance, clones, semantics, and graph
      if (folderPath) {
        handleRunWorkspaceScan();
        handleRunLuminanceScan();
        handleScanStructuralClones();
        handleScanSemanticClones();
        handleLoadWorkspaceGraph();
      }
    }

    setApplyingSurgery(false);
  };

  const handleUndoSurgery = async () => {
    if (!activeTab) return;
    addLog(`[SURGERY] Restoring surgery backup for ${activeTab.name}...`);

    let success = false;
    let restoredContent = "";

    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.undoSurgery) {
      try {
        const res = await window.electronAPI.undoSurgery({ file: activeTab.path });
        if (res && res.success) {
          success = true;
          restoredContent = res.restored_content;
          showToast(`Surgery undone · Backup restored`);
          addLog(`[SURGERY] Restored ${activeTab.name} from backup ${res.backup_path}`);
          console.log('[SURGERY] Restored', activeTab.name, 'from backup');
        } else {
          showToast(`Undo failed: ${res?.error || "No backup found"}`);
          addLog(`[ERROR] Undo surgery failed: ${res?.error || "No backup found"}`);
        }
      } catch (err) {
        console.error("[IDE-APP] Error undoing surgery:", err);
      }
    } else {
      // Fallback
      restoredContent = defaultCartCalculatorCode;
      success = true;
    }

    if (success) {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, content: restoredContent, savedContent: restoredContent, isDirty: false }
            : t
        )
      );
      setUndoAvailableForFile((prev) => ({ ...prev, [activeTab.path]: false }));

      // 1. Rerun AST analysis
      runAnalysis({ ...activeTab, content: restoredContent, savedContent: restoredContent, isDirty: false });

      // 2. Refresh workspace metrics & scans
      if (folderPath) {
        handleRunWorkspaceScan();
        handleRunLuminanceScan();
        handleScanStructuralClones();
        handleScanSemanticClones();
        handleLoadWorkspaceGraph();
      }
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

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        handleRunAiCodeAction("explain");
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR, () => {
        handleRunAiCodeAction("refactor");
      });

      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPos({ line: e.position.lineNumber, col: e.position.column });
        const model = editor.getModel();
        if (model) {
          const word = model.getWordAtPosition(e.position);
          if (word && word.word && word.word.trim()) {
            setSelectedCodeSymbol(word.word.trim());
          }
        }
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

      editor.onDidChangeCursorSelection((e: any) => {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          setSelectionInfo(null);
          return;
        }
        const model = editor.getModel();
        if (!model) return;
        const selectedText = model.getValueInRange(selection);
        if (selectedText && selectedText.trim()) {
          if (!selectedText.includes('\n')) {
            setSelectedCodeSymbol(selectedText.trim());
          }
        } else {
          setSelectionInfo(null);
          return;
        }

        const visiblePos = editor.getScrolledVisiblePosition(selection.getStartPosition());
        const domNode = editor.getDomNode ? editor.getDomNode() : null;
        const rect = domNode ? domNode.getBoundingClientRect() : { left: 100, top: 100 };

        setSelectionInfo({
          text: selectedText,
          x: rect.left + (visiblePos ? visiblePos.left : 100),
          y: rect.top + (visiblePos ? visiblePos.top : 100),
          startLineNumber: selection.startLineNumber,
          endLineNumber: selection.endLineNumber,
          startColumn: selection.startColumn,
          endColumn: selection.endColumn,
        });
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
      <header className="h-11 bg-[#0a0a0d] border-b border-[#1f1f24] flex items-center justify-between px-3 text-xs font-mono shrink-0 z-20 shadow-md min-w-0 w-full select-none gap-2">
        {/* Left Zone: Branding + Home Navigation */}
        <div className="flex-none shrink-0 flex items-center gap-2">
          <div className="flex items-center gap-1.5 pr-2 border-r border-[#1f1f24]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="font-heading font-bold text-xs text-white tracking-tight whitespace-nowrap">
              Echo Nullity
            </span>
          </div>

          <button
            onClick={() => setWorkspaceMode("home")}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceMode === "home"
                ? "bg-cyan-950 text-cyan-300 border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "bg-[#121216] hover:bg-[#1c1c24] border-[#24242e] text-zinc-300"
            }`}
            title="Task Home"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Home</span>
          </button>
        </div>

        {/* Center Zone: Active Task Title / Status */}
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2 py-1">
          {workspaceMode === "agent" ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0d0d14] border border-cyan-500/30 text-xs truncate max-w-xl">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-zinc-400 font-bold uppercase text-[10px]">Agent Task:</span>
              <span className="text-zinc-100 font-medium truncate">{activeTaskPrompt || "Active Agent Task"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0d0d14] border border-[#1f1f24] text-xs text-zinc-400">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="font-mono text-[11px]">AI-Native Autonomous Research Environment</span>
            </div>
          )}
        </div>

        {/* Right Zone: AI Agent Toggle, Tools Drawer Toggle, Command Palette & More Menu */}
        <div className="flex-none shrink-0 ml-auto flex items-center gap-1.5">
          {/* Tools Drawer Toggle */}
          <button
            onClick={() => {
              setToolsDrawerOpen((prev) => {
                const next = !prev;
                if (next) setShowExplorer(false);
                return next;
              });
            }}
            className={`min-h-[28px] px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              toolsDrawerOpen
                ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 font-bold"
                : "bg-[#121216] hover:bg-[#1c1c24] border-[#24242e] text-zinc-300"
            }`}
            title="Contextual Tools Drawer (⌘B)"
          >
            <FolderTree className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Tools</span>
          </button>

          {/* AI Agent Workspace Toggle */}
          <button
            onClick={() => {
              if (workspaceMode === "agent") {
                setWorkspaceMode("home");
              } else {
                setWorkspaceMode("agent");
                setAiPanelMode("agent");
                setAiPanelOpen(false);
              }
            }}
            className={`min-h-[28px] px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceMode === "agent"
                ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "bg-[#121216] hover:bg-[#1c1c24] border-[#24242e] text-cyan-300"
            }`}
            title="AI Agent Workspace (⌘⇧I)"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>AI</span>
          </button>

          {/* Command Palette (⌘K) */}
          <button
            onClick={() => setCmdPaletteOpen(true)}
            className="min-w-[28px] min-h-[28px] px-2 py-1 rounded-lg bg-[#121216] hover:bg-[#1c1c24] border border-[#24242e] text-cyan-300 transition-all flex items-center gap-1 cursor-pointer"
            title="Command Palette (⌘K)"
          >
            <Command className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden lg:inline text-[11px]">⌘K</span>
          </button>

          {/* More Menu Dropdown (⋯) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className="min-h-[28px] px-2 py-1 rounded-lg bg-[#121216] hover:bg-[#1c1c24] border border-[#24242e] text-zinc-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
              title="More Options"
            >
              <span>⋯</span>
            </button>

            {moreMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-[#0a0a0d] border border-[#1f1f24] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 font-mono text-xs animate-fade-in">
                <button
                  onClick={() => {
                    handleRunPythonDebugger();
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-cyan-300 hover:bg-[#141418] cursor-pointer"
                >
                  <Bug className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Debug (F10)</span>
                </button>
                <button
                  onClick={() => {
                    setMainView(mainView === "test_explorer" ? "editor" : "test_explorer");
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-emerald-300 hover:bg-[#141418] cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Test Explorer (⌘⇧T)</span>
                </button>
                <button
                  onClick={() => {
                    setMainView(mainView === "profiler" ? "editor" : "profiler");
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-amber-300 hover:bg-[#141418] cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Profiler (⌘⇧P)</span>
                </button>
                <button
                  onClick={() => {
                    setMainView(mainView === "security_audit" ? "editor" : "security_audit");
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-red-300 hover:bg-[#141418] cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Security Audit (⌘⇧S)</span>
                </button>
                <button
                  onClick={() => {
                    setMainView(mainView === "snapshots" ? "editor" : "snapshots");
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-cyan-300 hover:bg-[#141418] cursor-pointer"
                >
                  <HistoryIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Snapshots (⌘⇧B)</span>
                </button>
                <div className="h-px bg-[#1f1f24] my-1" />
                <button
                  onClick={() => {
                    handleExportReport();
                    setMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-emerald-300 hover:bg-[#141418] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Export Report</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Contextual Tools Drawer */}
      <ContextualToolsDrawer
        isOpen={toolsDrawerOpen}
        activeTab={toolsDrawerTab}
        onTabChange={setToolsDrawerTab}
        onClose={() => setToolsDrawerOpen(false)}
        explorerContent={
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-400 uppercase tracking-widest font-bold text-[10px]">Explorer</span>
              <span className="text-cyan-400 text-[10px]">Tree-sitter</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto space-y-1 font-mono text-xs">
              {fileTree && renderTree(fileTree)}
            </div>
          </div>
        }
        searchContent={
          <SearchPanel
            query={search.query}
            setQuery={search.setQuery}
            replaceText={search.replaceText}
            setReplaceText={search.setReplaceText}
            isRegex={search.isRegex}
            setIsRegex={search.setIsRegex}
            isCaseSensitive={search.isCaseSensitive}
            setIsCaseSensitive={search.setIsCaseSensitive}
            isWholeWord={search.isWholeWord}
            setIsWholeWord={search.setIsWholeWord}
            includeHidden={search.includeHidden}
            setIncludeHidden={search.setIncludeHidden}
            results={search.results}
            groupedResults={search.groupedResults}
            totalFiles={search.totalFiles}
            totalMatches={search.totalMatches}
            selectedResultIndex={search.selectedResultIndex}
            loading={search.loading}
            error={search.error}
            durationMs={search.durationMs}
            onSelectMatch={(m, idx) => {
              handleSelectSearchMatch(m, idx || 0);
              setToolsDrawerOpen(false);
            }}
            onReplaceSingle={(m) => search.replaceSingle(m)}
            onReplaceAllInFile={(f) => search.replaceAllInFile(f)}
            onReplaceAllInWorkspace={() => search.replaceAllInWorkspace()}
            onNavigateResult={(dir) => search.navigateResult(dir)}
          />
        }
        gitContent={
          <SourceControlPanel
            isRepo={git.isRepo}
            currentBranch={git.currentBranch}
            branches={git.branches}
            staged={git.staged}
            unstaged={git.unstaged}
            untracked={git.untracked}
            lastCommit={git.lastCommit}
            loading={git.loading}
            statusMessage={git.statusMessage}
            errorMessage={git.errorMessage}
            onRefresh={() => git.refreshStatus(folderPath || "")}
            onStageFile={(f) => git.stageFile(f)}
            onUnstageFile={(f) => git.unstageFile(f)}
            onStageAll={() => git.stageAllFiles()}
            onUnstageAll={() => git.unstageAllFiles()}
            onCommit={(msg) => git.commitChanges(msg)}
            onCheckoutBranch={(b) => git.checkoutBranch(b)}
            onCreateBranch={(b) => git.createAndCheckoutBranch(b)}
            onDiscardFile={(f) => git.discardFile(f)}
            onOpenFileDiff={handleOpenGitDiff}
          />
        }
        testsContent={
          <TestExplorerPanel
            workspacePath={folderPath || ""}
            onOpenTestFile={(file) => {
              handleOpenTestFile(file, undefined);
              setToolsDrawerOpen(false);
            }}
            testsHook={testsHook}
          />
        }
        debuggerContent={
          <DebuggerPanel
            isOpen={true}
            onClose={() => setToolsDrawerOpen(false)}
            steps={debugSteps}
            currentIndex={debugIndex}
            onStepChange={setDebugIndex}
            onRestart={handleRunPythonDebugger}
          />
        }
        terminalContent={
          <TerminalPanel
            tabs={terminalTabs}
            activeTabId={activeTerminalTabId}
            onSelectTab={(id) => setActiveTerminalTabId(id)}
            onCreateTab={() => createTerminalTab(folderPath || "")}
            onCloseTab={(id) => closeTerminalTab(id)}
            onRestartTab={(id) => restartTerminalTab(id)}
            onSendInput={(id, input) => sendTerminalInput(id, input)}
            logs={logs}
            onClearLogs={() => setLogs([])}
            debugLogs={debugSteps.map((s) => `[Step ${s.step}] Line ${s.line} in ${s.functionName || "global"}`)}
            pythonOutput={pythonOutput}
            onClearDebugLogs={() => setPythonOutput("")}
            activeMode={terminalPanelMode}
            onModeChange={(mode) => setTerminalPanelMode(mode)}
            onClosePanel={() => setToolsDrawerOpen(false)}
          />
        }
      />

      {/* 2. Main Resizable Workspace Grid */}
      <div ref={contentRowRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", overflow: "hidden" }} className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
        
        {workspaceMode === "home" ? (
          <TaskHome
            workspacePath={folderPath || "demo-workspaces/ai_cart_project"}
            onStartTask={(promptText) => {
              setActiveTaskPrompt(promptText);
              setWorkspaceMode("agent");
              setAiPanelMode("agent");
              setAiPanelOpen(false);
              addLog(`[TASK] Started AI task: ${promptText}`);
            }}
            onContinueSession={async (sessionId, userGoal) => {
              const restoredPrompt = userGoal || "Resumed Continuum Session Task";
              setActiveTaskPrompt(restoredPrompt);
              setWorkspaceMode("agent");
              setAiPanelMode("agent");
              setAiPanelOpen(false);
              if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.resumeSession) {
                try {
                  await (window as any).electronAPI.continuum.resumeSession(sessionId, folderPath || "");
                  addLog(`[CONTINUUM] Resumed session ${sessionId}`);
                } catch (e) {
                  console.error("[IDE] Resume session error:", e);
                }
              }
            }}
            onOpenFolder={handleOpenFolder}
            gitBranch={git.currentBranch || "main"}
            fileCount={openTabs.length}
          />
        ) : workspaceMode === "agent" ? (
          <AgentWorkspace
            workspacePath={folderPath || "demo-workspaces/ai_cart_project"}
            activeFilePath={activeTabPath}
            activeTaskPrompt={activeTaskPrompt}
            onBackToHome={() => setWorkspaceMode("home")}
            onPreviewDiff={handleAgentPreviewDiff}
            onApplyStep={handleApplyAgentStep}
            onApplyAllApproved={handleApplyAllAgentApproved}
            runningCommandOutput={agentRunningCommandOutput}
            editorCanvas={
              <div className="flex-1 flex flex-col h-full bg-[#050508] relative overflow-hidden">
                {/* Multi-Tab Bar with Contextual Run Button */}
                <div className="h-9 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center px-2 gap-1 font-mono text-xs overflow-x-auto shrink-0">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      onClick={() => {
                        setActiveTabPath(tab.path);
                        restoreTabCursor(tab.path);
                        runAnalysis(tab);
                      }}
                      className={`group px-3 py-1 rounded-t-lg flex items-center gap-2 cursor-pointer transition-all ${
                        activeTabPath === tab.path
                          ? "bg-[#050505] text-cyan-400 border-t border-x border-cyan-500/40 font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{tab.name}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-2 pr-2">
                    <button
                      onClick={(e) => {
                        if (activeTab && activeTab.path.endsWith(".py")) {
                          handleExecutePython(e);
                        } else {
                          runAnalysis(activeTab || undefined);
                        }
                      }}
                      disabled={pythonRunning || analyzing}
                      className="px-2.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Run Code (F5)"
                    >
                      <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                      <span>{pythonRunning ? "Running..." : "Run Code"}</span>
                    </button>
                  </div>
                </div>

                {/* Monaco Code Editor Canvas */}
                <div ref={monacoWrapperRef} className="flex-1 relative overflow-hidden">
                  {activeTab ? (
                    <MonacoEditor
                      height="100%"
                      language={getLanguageFromPath(activeTab.path)}
                      theme="echo-dark"
                      value={activeTab.content}
                      onChange={handleEditorChange}
                      onMount={handleEditorMount}
                      options={{
                        minimap: { enabled: true },
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: "on",
                        renderLineHighlight: "all",
                        lineNumbers: "on",
                        glyphMargin: true,
                        cursorBlinking: "smooth",
                        smoothScrolling: true,
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs">
                      No active file in editor.
                    </div>
                  )}
                </div>
              </div>
            }
          />
        ) : (
          <>

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
          
          {mainView === "dashboard" || mainView === "luminance" ? (
            <WorkspaceDashboard
              summary={workspaceSummary || workspaceReport}
              luminanceReport={luminanceReport}
              loading={workspaceLoading || workspaceScanLoading || luminanceLoading}
              onRescan={handleRunWorkspaceScan}
              onOpenFile={(file) => {
                handleOpenWorkspaceFile(file);
                setMainView("editor");
              }}
              onJumpToStatement={(file, line) => handleJumpToStatement(file, line)}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "graph" ? (
            <WorkspaceGraphPanel
              graph={workspaceGraph}
              loading={graphLoading}
              onRefresh={() => handleLoadWorkspaceGraph()}
              onNodeClick={handleGraphNodeClick}
              onClose={() => setMainView("editor")}
              impactRadiusResult={impactRadiusResult}
              blastRadiusResult={blastRadiusResult}
              counterfactualResult={counterfactualResult}
            />
          ) : mainView === "clones" ? (
            <ClonePanel
              report={cloneReport}
              loading={cloneLoading}
              onRunScan={handleRunCloneScan}
              onSelectInstance={handleSelectCloneInstance}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "semantic_clones" ? (
            <SemanticClonePanel
              report={semanticCloneReport}
              loading={semanticCloneLoading}
              onRunScan={handleRunSemanticCloneScan}
              onSelectInstance={handleSelectSemanticCloneInstance}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "behavior_fingerprint" ? (
            <BehaviorFingerprintPanel
              filePath={activeTabPath}
              report={fingerprintReport}
              loading={fingerprintLoading}
              onGenerate={(fp) => handleGenerateFingerprint(fp)}
              onClose={() => setMainView("editor")}
              workspaceGraph={workspaceGraph}
              onImpactRadiusComputed={(res) => setImpactRadiusResult(res)}
              onSelectImpactNode={(file, line) => {
                handleJumpToStatement(file, line);
                setMainView("graph");
              }}
              onRunBlastRadius={handleRunBlastRadius}
              blastRadiusResult={blastRadiusResult}
              currentFileContent={activeTab?.content || ""}
              onRunCounterfactual={handleRunCounterfactual}
              counterfactualResult={counterfactualResult}
            />
          ) : mainView === "patch_firewall" ? (
            <PatchFirewallPanel
              report={patchFirewallReport}
              loading={patchFirewallLoading}
              onRunAnalysis={(patchText) => handleEvaluatePatchFirewall(patchText)}
              onClose={() => setMainView("editor")}
              currentFile={activeTabPath}
            />
          ) : mainView === "repository_patch_firewall" ? (
            <RepositoryPatchFirewallPanel
              report={repositoryFirewallReport}
              loading={repositoryFirewallLoading}
              onRunAnalysis={(patchText) => handleEvaluateRepositoryFirewall(patchText)}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "semantic_intent_radar" ? (
            <SemanticIntentRadarPanel
              report={semanticIntentReport}
              loading={semanticIntentLoading}
              onRunAnalysis={(orig, edit) => handleAnalyzeSemanticIntentDrift(orig, edit)}
              onClose={() => setMainView("editor")}
            />
          ) : mainView === "source_control" ? (
            <div className="flex-1 flex overflow-hidden">
              <div style={{ width: `${explorerWidth}px` }} className="shrink-0 h-full">
                <SourceControlPanel
                  isRepo={git.isRepo}
                  currentBranch={git.currentBranch}
                  branches={git.branches}
                  staged={git.staged}
                  unstaged={git.unstaged}
                  untracked={git.untracked}
                  lastCommit={git.lastCommit}
                  loading={git.loading}
                  statusMessage={git.statusMessage}
                  errorMessage={git.errorMessage}
                  onRefresh={() => git.refreshStatus(folderPath || "")}
                  onStageFile={(f) => git.stageFile(f)}
                  onUnstageFile={(f) => git.unstageFile(f)}
                  onStageAll={() => git.stageAllFiles()}
                  onUnstageAll={() => git.unstageAllFiles()}
                  onCommit={(msg) => git.commitChanges(msg)}
                  onCheckoutBranch={(b) => git.checkoutBranch(b)}
                  onCreateBranch={(b) => git.createAndCheckoutBranch(b)}
                  onDiscardFile={(f) => git.discardFile(f)}
                  onOpenFileDiff={handleOpenGitDiff}
                />
              </div>
              <div className="flex-1 h-full flex flex-col bg-[#08080a] border-l border-[#1f1f1f]">
                {gitDiffModalFile && gitDiffData ? (
                  <div className="h-full flex flex-col">
                    <div className="h-9 bg-[#0d0d10] border-b border-[#1f1f1f] px-3 flex items-center justify-between text-xs text-zinc-300">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-zinc-100">{gitDiffModalFile.path}</span>
                        <span className="text-zinc-500">({gitDiffModalFile.staged ? "Staged Diff vs HEAD" : "Working Tree Diff"})</span>
                      </div>
                      <button
                        onClick={() => {
                          setGitDiffModalFile(null);
                          setGitDiffData(null);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 cursor-pointer"
                        title="Close Diff"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 font-mono text-xs text-zinc-300 whitespace-pre-wrap bg-[#050507]">
                      {gitDiffData.diff ? (
                        gitDiffData.diff.split("\n").map((line, idx) => {
                          let colorClass = "text-zinc-400";
                          let bgClass = "";
                          if (line.startsWith("+") && !line.startsWith("+++")) {
                            colorClass = "text-emerald-300";
                            bgClass = "bg-emerald-950/30";
                          } else if (line.startsWith("-") && !line.startsWith("---")) {
                            colorClass = "text-rose-300";
                            bgClass = "bg-rose-950/30";
                          } else if (line.startsWith("@@")) {
                            colorClass = "text-cyan-400 font-bold";
                            bgClass = "bg-cyan-950/20";
                          }
                          return (
                            <div key={idx} className={`px-2 py-0.5 ${colorClass} ${bgClass}`}>
                              {line}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-zinc-600 italic">No textual diff detected for this file.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 font-mono text-xs">
                    <GitBranch className="w-8 h-8 mb-2 text-zinc-700" />
                    <div>Select a changed file from the sidebar to inspect diff</div>
                  </div>
                )}
              </div>
            </div>
          ) : mainView === "search" ? (
            <div className="flex-1 flex overflow-hidden">
              <div style={{ width: `${explorerWidth}px` }} className="shrink-0 h-full">
                <SearchPanel
                  query={search.query}
                  setQuery={search.setQuery}
                  replaceText={search.replaceText}
                  setReplaceText={search.setReplaceText}
                  isRegex={search.isRegex}
                  setIsRegex={search.setIsRegex}
                  isCaseSensitive={search.isCaseSensitive}
                  setIsCaseSensitive={search.setIsCaseSensitive}
                  isWholeWord={search.isWholeWord}
                  setIsWholeWord={search.setIsWholeWord}
                  includeHidden={search.includeHidden}
                  setIncludeHidden={search.setIncludeHidden}
                  results={search.results}
                  groupedResults={search.groupedResults}
                  totalFiles={search.totalFiles}
                  totalMatches={search.totalMatches}
                  selectedResultIndex={search.selectedResultIndex}
                  loading={search.loading}
                  error={search.error}
                  durationMs={search.durationMs}
                  onSelectMatch={handleSelectSearchMatch}
                  onReplaceSingle={(m) => search.replaceSingle(m)}
                  onReplaceAllInFile={(f) => search.replaceAllInFile(f)}
                  onReplaceAllInWorkspace={() => search.replaceAllInWorkspace()}
                  onNavigateResult={(dir) => search.navigateResult(dir)}
                />
              </div>
              <div className="flex-1 h-full flex flex-col bg-[#050507]">
                {/* Multi-Tab Bar */}
                <div className="h-9 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center px-2 gap-1 font-mono text-xs overflow-x-auto shrink-0">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      onClick={() => {
                        setActiveTabPath(tab.path);
                        restoreTabCursor(tab.path);
                        runAnalysis(tab);
                      }}
                      className={`group px-3 py-1 rounded-t-lg flex items-center gap-2 cursor-pointer transition-all ${
                        activeTabPath === tab.path
                          ? "bg-[#050505] text-cyan-400 border-t border-x border-cyan-500/40 font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{tab.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Editor Surface */}
                <div className="flex-1 relative bg-[#050505] overflow-hidden">
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
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        theme: "vs-dark",
                        tabSize: 2,
                        wordWrap: "on",
                        padding: { top: 12, bottom: 12 },
                        renderLineHighlight: "all",
                        lineNumbers: "on",
                        glyphMargin: true,
                        cursorBlinking: "smooth",
                        smoothScrolling: true,
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs">
                      No file selected. Click a search result to view.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : mainView === "test_explorer" ? (
            <div className="flex-1 flex overflow-hidden">
              <div style={{ width: `${explorerWidth + 40}px` }} className="shrink-0 h-full">
                <TestExplorerPanel
                  workspacePath={folderPath || ""}
                  onOpenTestFile={handleOpenTestFile}
                  testsHook={testsHook}
                />
              </div>
              <div className="flex-1 h-full flex flex-col bg-[#050507]">
                {/* Multi-Tab Bar */}
                <div className="h-9 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center px-2 gap-1 font-mono text-xs overflow-x-auto shrink-0">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      onClick={() => {
                        setActiveTabPath(tab.path);
                        restoreTabCursor(tab.path);
                        runAnalysis(tab);
                      }}
                      className={`group px-3 py-1 rounded-t-lg flex items-center gap-2 cursor-pointer transition-all ${
                        activeTabPath === tab.path
                          ? "bg-[#050505] text-cyan-400 border-t border-x border-cyan-500/40 font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{tab.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Editor or Empty State */}
                <div className="flex-1 relative overflow-hidden">
                  {activeTab ? (
                    <MonacoEditor
                      height="100%"
                      language={getLanguageFromPath(activeTab.path)}
                      theme="echo-dark"
                      value={activeTab.content}
                      onChange={handleEditorChange}
                      onMount={handleEditorMount}
                      options={{
                        minimap: { enabled: true },
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: "on",
                        renderLineHighlight: "all",
                        lineNumbers: "on",
                        glyphMargin: true,
                        cursorBlinking: "smooth",
                        smoothScrolling: true,
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs">
                      No test file selected. Select a test from the Test Explorer to inspect code.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : mainView === "profiler" ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 h-full flex flex-col">
                <ProfilerPanel
                  profiler={profiler}
                  activeCode={activeTab?.content || ""}
                  activeFilePath={activeTab?.path || ""}
                  onSelectFile={handleOpenTestFile}
                />
              </div>
            </div>
          ) : mainView === "security_audit" ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 h-full flex flex-col">
                <SecurityAuditPanel
                  auditHook={securityAudit}
                  onOpenFile={handleOpenTestFile}
                />
              </div>
            </div>
          ) : mainView === "snapshots" ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 h-full flex flex-col">
                <SnapshotPanel
                  snapshotHook={snapshotHook}
                  onOpenFile={handleOpenTestFile}
                  openTabs={openTabs}
                  activeTabPath={activeTabPath}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Multi-Tab Bar */}
              <div className="h-9 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center px-2 gap-1 font-mono text-xs overflow-x-auto shrink-0">
                {openTabs.map((tab) => (
                  <div
                    key={tab.path}
                    onClick={() => {
                      setActiveTabPath(tab.path);
                      setMainView("editor");
                      restoreTabCursor(tab.path);
                      runAnalysis(tab);
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

                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          handleCloseTab(tab.path, e as any);
                        }
                      }}
                      className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity inline-block cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </div>
                ))}
              </div>

              {/* Monaco Editor Container & Live Web Preview Split Pane */}
              <div ref={monacoWrapperRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative", overflow: "hidden", display: "flex" }} className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-[#050505] flex">
                <div style={{ flex: showLivePreview ? 0.5 : 1, minWidth: 0, height: "100%", position: "relative" }} className="h-full">
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

                {showLivePreview && (
                  <div style={{ flex: 0.5, minWidth: 0, height: "100%" }} className="h-full border-l border-[#1f1f1f]">
                    <LiveWebPreviewPanel
                      activeTab={activeTab}
                      openTabs={openTabs}
                      onClose={() => setShowLivePreview(false)}
                    />
                  </div>
                )}
              </div>

              {/* Gutter Heatmap & Luminance Panel (Contextual - Only visible when Analysis is active) */}
              {showRightPanel && activeFileLuminance && (
                <CodeEditorPanel
                  filePath={activeTabPath}
                  fileLuminance={activeFileLuminance}
                  onJumpToLine={(l) => {
                    if (editorRef.current) {
                      try {
                        editorRef.current.revealLineInCenter(l);
                        editorRef.current.setPosition({ lineNumber: l, column: 1 });
                        editorRef.current.focus();
                      } catch (e) {}
                    }
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Resizer col 2 */}
        {showRightPanel && (
          <div onMouseDown={startAnalysisResize} className="resizer-col" />
        )}

        {/* Right Pane: Tomography Analysis Panel */}
        {showRightPanel && (
          <div ref={analysisPanelRef} style={{ width: `${analysisWidth}px`, flexShrink: 0 }} className="bg-[#0a0a0a] border-l border-[#1f1f1f] flex flex-col justify-between p-4 space-y-4 shrink-0 overflow-y-auto select-none">
            <div className="space-y-4">
              
              {/* Header */}
              <div className="pb-3 border-b border-[#1f1f1f] flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-white">Code Analysis</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px]">
                    Health: {luminance.toFixed(2)}
                  </span>
                  <button
                    onClick={() => setShowRightPanel(false)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Close Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

            {/* Panel Tabs: Active File vs Project Scan vs BDG vs Clones vs Semantic */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-[#050505] rounded-xl border border-[#1f1f1f] text-[10px] font-mono">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRightPanelTab("file")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRightPanelTab("file");
                  }
                }}
                className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === "file"
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>File</span>
                <span className="px-1 py-0.2 rounded-full bg-zinc-800 text-[8px] text-zinc-300">
                  {findings.length}
                </span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRightPanelTab("bdg")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRightPanelTab("bdg");
                  }
                }}
                className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === "bdg"
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>BDG</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRightPanelTab("project")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRightPanelTab("project");
                  }
                }}
                className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === "project"
                    ? "bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Proj</span>
                {workspaceReport && (
                  <span className="px-1 py-0.2 rounded-full bg-purple-900/60 text-[8px] text-purple-200">
                    {workspaceReport.total_ghost_lines}
                  </span>
                )}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRightPanelTab("clones")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRightPanelTab("clones");
                  }
                }}
                className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === "clones"
                    ? "bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Clone</span>
                {structuralCloneGroups.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-fuchsia-900/60 text-[8px] text-fuchsia-200">
                    {structuralCloneGroups.length}
                  </span>
                )}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRightPanelTab("semantic")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRightPanelTab("semantic");
                  }
                }}
                className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === "semantic"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Sem</span>
                {semanticCloneGroups.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-amber-900/60 text-[8px] text-amber-200">
                    {semanticCloneGroups.length}
                  </span>
                )}
              </div>
            </div>

            {rightPanelTab === "bdg" ? (
              <BDGInspectorPanel
                workspacePath={folderPath || undefined}
                activeFilePath={activeTabPath}
                cursorLine={cursorPos.line}
                selectedSymbol={selectedCodeSymbol || (selectedFinding as any)?.symbol || (selectedFinding as any)?.code}
                onJumpToSymbol={(f, l) => handleJumpToStatement(f, l)}
              />
            ) : rightPanelTab === "semantic" ? (
              /* Semantic Clones View */
              <div className="space-y-4">
                {/* Semantic Clone Summary Metrics */}
                <div className="p-3 bg-[#050505] rounded-xl border border-[#1f1f1f] space-y-2 font-mono text-xs shadow-inner">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Semantic Groups:</span>
                    <span className="text-amber-400 font-bold">{semanticCloneGroups.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Occurrences:</span>
                    <span className="text-orange-400 font-bold">
                      {semanticCloneGroups.reduce((acc, g) => acc + g.occurrences.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">AST Normalization:</span>
                    <span className="text-amber-300 font-bold">Identity + Commutative</span>
                  </div>
                </div>

                {/* Semantic Clone Groups List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                    <span>Semantic Clone Groups</span>
                    <span className="text-[10px] text-zinc-500 lowercase">by confidence</span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto font-mono text-xs pr-1">
                    {semanticCloneGroups.length > 0 ? (
                      semanticCloneGroups.map((group, gIdx) => (
                        <div
                          key={gIdx}
                          className="p-3 bg-[#050505] rounded-xl border border-zinc-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[11px] font-bold text-amber-300 truncate max-w-[150px]"
                              title={group.fingerprint}
                            >
                              {group.fingerprint}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-amber-950/80 text-amber-300 border-amber-500/40">
                              {Math.round(group.confidence * 100)}% Confidence
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {group.occurrences.map((occ, oIdx) => (
                              <div
                                key={oIdx}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleOpenCloneOccurrence(occ)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleOpenCloneOccurrence(occ);
                                  }
                                }}
                                className="w-full text-left p-2 bg-[#0d0d0d] hover:bg-zinc-900/70 hover:border-amber-400/80 transition-all rounded-lg border border-zinc-800/80 space-y-1 group cursor-pointer"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-cyan-300 font-bold group-hover:text-cyan-200 truncate max-w-[140px]">
                                    {occ.file}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                                    L{occ.start_line}–L{occ.end_line}
                                  </span>
                                </div>
                                <div className="text-zinc-300 font-mono bg-[#050505] p-1.5 rounded border border-zinc-900 truncate text-[10px]">
                                  {occ.code}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono space-y-2">
                        <p>No semantic clones scanned yet.</p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleScanSemanticClones}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleScanSemanticClones();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-500/40 text-[11px] font-bold hover:bg-amber-900 transition-all inline-block cursor-pointer"
                        >
                          {semanticCloneScanLoading ? "Scanning..." : "Find Semantic Clones"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : rightPanelTab === "clones" ? (
              /* Structural Clones View */
              <div className="space-y-4">
                {/* Clone Summary Metrics */}
                <div className="p-3 bg-[#050505] rounded-xl border border-[#1f1f1f] space-y-2 font-mono text-xs shadow-inner">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Clone Groups:</span>
                    <span className="text-fuchsia-400 font-bold">{structuralCloneGroups.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Occurrences:</span>
                    <span className="text-purple-400 font-bold">
                      {structuralCloneGroups.reduce((acc, g) => acc + g.occurrences.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">AST Normalization:</span>
                    <span className="text-emerald-400 font-bold">Canonical</span>
                  </div>
                </div>

                {/* Clone Groups List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                    <span>Structural Clone Groups</span>
                    <span className="text-[10px] text-zinc-500 lowercase">by occurrences</span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto font-mono text-xs pr-1">
                    {structuralCloneGroups.length > 0 ? (
                      structuralCloneGroups.map((group, gIdx) => (
                        <div
                          key={gIdx}
                          className="p-3 bg-[#050505] rounded-xl border border-zinc-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[11px] font-bold text-fuchsia-300 truncate max-w-[170px]"
                              title={group.fingerprint}
                            >
                              {group.fingerprint}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/40">
                              {group.occurrences_count} {group.occurrences_count === 1 ? "match" : "matches"}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {group.occurrences.map((occ, oIdx) => (
                              <div
                                key={oIdx}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleOpenCloneOccurrence(occ)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleOpenCloneOccurrence(occ);
                                  }
                                }}
                                className="w-full text-left p-2 bg-[#0d0d0d] hover:bg-zinc-900/70 hover:border-fuchsia-400/80 transition-all rounded-lg border border-zinc-800/80 space-y-1 group cursor-pointer"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-cyan-300 font-bold group-hover:text-cyan-200 truncate max-w-[140px]">
                                    {occ.file}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                                    L{occ.start_line}–L{occ.end_line}
                                  </span>
                                </div>
                                <div className="text-zinc-300 font-mono bg-[#050505] p-1.5 rounded border border-zinc-900 truncate text-[10px]">
                                  {occ.code}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono space-y-2">
                        <p>No structural clones scanned yet.</p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleScanStructuralClones}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleScanStructuralClones();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40 text-[11px] font-bold hover:bg-fuchsia-900 transition-all inline-block cursor-pointer"
                        >
                          {structuralCloneLoading ? "Scanning..." : "Find Clones"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : rightPanelTab === "project" ? (
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
                          <div
                            key={i}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenWorkspaceFile(file)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleOpenWorkspaceFile(file);
                              }
                            }}
                            className="w-full text-left p-3 bg-[#050505] hover:bg-[#0d0d0d] hover:border-cyan-400 transition-all rounded-xl border border-zinc-800 space-y-1.5 group cursor-pointer"
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
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono space-y-2">
                        <p>No project scan performed yet.</p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleRunWorkspaceScan}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleRunWorkspaceScan();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold hover:bg-cyan-900 transition-all inline-block cursor-pointer"
                        >
                          {workspaceScanLoading ? "Scanning..." : "Run Workspace Scan"}
                        </span>
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
                          <div
                            key={i}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleFindingClick(f)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleFindingClick(f);
                              }
                            }}
                            className={`w-full text-left p-2.5 bg-[#050505] hover:bg-[#0d0d0d] transition-all rounded-xl border space-y-1 group cursor-pointer ${
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
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-[11px] text-zinc-400 font-sans leading-tight flex-1">
                                {f.reason}
                              </p>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFindingClick(f);
                                  handleOpenDiffPreview(f);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    handleFindingClick(f);
                                    handleOpenDiffPreview(f);
                                  }
                                }}
                                className="ml-2 px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold whitespace-nowrap transition-all inline-block cursor-pointer"
                              >
                                Preview Surgery
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono">
                        {analysisError ? `Analysis failed: ${analysisError}` : "No vacuous ghost lines detected. Code is causally optimal."}
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
          {findings.length > 0 && (
            <button
              onClick={handleOpenDiffPreview}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-cyan-glow transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-black" />
              <span>Preview Safe Remove ({findings.length})</span>
            </button>
          )}
        </div>
      )}
          </>
        )}

      </div>

      {/* Resizer row for terminal/output panel */}
      {showTerminalPanel && (
        <div onMouseDown={startConsoleResize} className="resizer-row" />
      )}

      {/* Integrated Terminal Panel with Terminal, Output & Debug Console tabs */}
      {showTerminalPanel && (
        <div style={{ height: `${consoleHeight}px` }} className="shrink-0 z-20">
          <TerminalPanel
            tabs={terminalTabs}
            activeTabId={activeTerminalTabId}
            onSelectTab={(id) => setActiveTerminalTabId(id)}
            onCreateTab={() => createTerminalTab(folderPath || "")}
            onCloseTab={(id) => closeTerminalTab(id)}
            onRestartTab={(id) => restartTerminalTab(id)}
            onSendInput={(id, input) => sendTerminalInput(id, input)}
            logs={logs}
            onClearLogs={() => setLogs([])}
            debugLogs={debugSteps.map((s) => `[Step ${s.step}] Line ${s.line} in ${s.functionName || "global"}`)}
            pythonOutput={pythonOutput}
            onClearDebugLogs={() => setPythonOutput("")}
            activeMode={terminalPanelMode}
            onModeChange={(mode) => setTerminalPanelMode(mode)}
            onClosePanel={() => setShowTerminalPanel(false)}
          />
        </div>
      )}

      {/* Persistent Status Bar */}
      <footer className="h-7 bg-[#070707] border-t border-[#1f1f1f] px-3 flex items-center justify-between font-mono text-[10px] text-zinc-400 shrink-0 z-20 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="font-bold">ECHO STATUS</span>
          </div>
          <span>File: <strong className="text-cyan-300">{activeTab?.name || "No file"}</strong></span>
          <span>Lang: <strong className="text-purple-300">{getLanguageFromPath(activeTab?.path || "")}</strong></span>
          <span className="text-zinc-500 hidden sm:inline">Analyzer: <strong className="text-emerald-400">Rust/Python AST Ready</strong></span>
          {git.isRepo && git.currentBranch && (
            <button
              onClick={() => setMainView("source_control")}
              aria-label={`Git Branch ${git.currentBranch}, click to open Source Control`}
              className="flex items-center gap-1 text-cyan-300 font-bold hover:text-cyan-200 cursor-pointer bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              title={`Git Branch: ${git.currentBranch} (Click to open Source Control)`}
            >
              <GitBranch className="w-3 h-3 text-cyan-400" />
              <span>{git.currentBranch}</span>
              {(git.staged.length > 0 || git.unstaged.length > 0 || git.untracked.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          )}

          {/* AI Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#121216] border border-[#27272a] select-none">
            {aiLoading ? (
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                <span>AI Busy</span>
              </span>
            ) : (
              <span className="text-zinc-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>AI Ready</span>
              </span>
            )}
          </div>

          {/* Debugger Status Indicator */}
          {debugPanelOpen && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 select-none">
              <Bug className="w-3 h-3 text-cyan-400" />
              <span>
                Debugging (Step {debugSteps.length > 0 ? debugIndex + 1 : 0}/{debugSteps.length})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTerminalPanel((prev) => !prev)}
            aria-label="Toggle Integrated Terminal Drawer"
            className={`min-h-[20px] px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
              showTerminalPanel
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                : "bg-[#141414] text-zinc-400 hover:text-white border border-[#262626]"
            }`}
            title="Toggle Integrated Terminal (⌘`)"
          >
            <TerminalIcon className="w-3 h-3 text-cyan-400" />
            <span>Terminal {terminalTabs.length > 0 ? `(${terminalTabs.length})` : ""}</span>
          </button>

          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="text-purple-400 font-bold">
            {findings.length > 0 ? `${findings.length} Redundant Lines` : "Clean Architecture"}
          </span>
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
      </footer>

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

          {/* Differential Behavioral Harness Verification Card */}
          <div className="p-3 mx-4 mt-3 bg-[#0d0d0d] border border-[#222] rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Behavioral Verification</span>
              </div>
              {behaviorVerifying ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold animate-pulse">
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>Testing Subprocess (3s)...</span>
                </span>
              ) : behaviorResult?.behavior_preserved ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Behavior Preserved</span>
                </span>
              ) : behaviorResult ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>Behavior Changed</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[10px]">
                  <span>Pending Test</span>
                </span>
              )}
            </div>

            {behaviorResult && (
              <div className="space-y-2 pt-1 border-t border-[#1a1a1a] text-[11px]">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 bg-[#050505] rounded border border-[#1f1f1f]">
                    <div className="text-[9px] text-zinc-500 uppercase">stdout</div>
                    <div className={behaviorResult.original?.stdout?.trim() === behaviorResult.transformed?.stdout?.trim() ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {behaviorResult.original?.stdout?.trim() === behaviorResult.transformed?.stdout?.trim() ? "identical" : "mismatch"}
                    </div>
                  </div>
                  <div className="p-1.5 bg-[#050505] rounded border border-[#1f1f1f]">
                    <div className="text-[9px] text-zinc-500 uppercase">stderr</div>
                    <div className={behaviorResult.original?.stderr?.trim() === behaviorResult.transformed?.stderr?.trim() ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {behaviorResult.original?.stderr?.trim() === behaviorResult.transformed?.stderr?.trim() ? "identical" : "mismatch"}
                    </div>
                  </div>
                  <div className="p-1.5 bg-[#050505] rounded border border-[#1f1f1f]">
                    <div className="text-[9px] text-zinc-500 uppercase">exit code</div>
                    <div className={behaviorResult.original?.exit_code === behaviorResult.transformed?.exit_code ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {behaviorResult.original?.exit_code === behaviorResult.transformed?.exit_code ? `identical (${behaviorResult.transformed?.exit_code})` : "mismatch"}
                    </div>
                  </div>
                </div>

                {behaviorResult.differences && behaviorResult.differences.length > 0 && (
                  <div className="p-2 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-[10px] space-y-0.5">
                    <div className="font-bold uppercase tracking-wider text-[9px] text-red-400">Differences Detected:</div>
                    {behaviorResult.differences.map((diff: string, idx: number) => (
                      <div key={idx}>• {diff}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-[#050505]">
            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Unified AST Diff Stream</span>
            
            <div className="space-y-1 border border-[#1f1f1f] rounded-xl p-3 bg-[#0d0d0d]">
              {(() => {
                const originalLines = diffData.original_source.split("\n");
                const transformedLines = diffData.transformed_source.split("\n");
                const removalOnly = transformedLines.join("\n") === originalLines
                  .filter((_, idx) => !diffData.changed_lines.includes(idx + 1))
                  .join("\n");

                return originalLines.map((origLine, idx) => {
                const lineNum = idx + 1;
                const isChanged = diffData.changed_lines.includes(lineNum);
                const newContent = transformedLines[idx] || "";

                if (isChanged) {
                  return (
                    <div key={lineNum} className="space-y-1 my-1">
                      <div className="px-2 py-1 bg-red-950/60 border-l-2 border-red-500 text-red-300 flex justify-between">
                        <span>- {lineNum}: {origLine}</span>
                        <span className="text-[9px] text-red-400 uppercase">Ghost</span>
                      </div>
                      {!removalOnly && (
                        <div className="px-2 py-1 bg-emerald-950/60 border-l-2 border-emerald-500 text-emerald-300 flex justify-between">
                          <span>+ {lineNum}: {newContent}</span>
                          <span className="text-[9px] text-emerald-400 uppercase">Optimal</span>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={lineNum} className="px-2 py-0.5 text-zinc-500">
                    &nbsp;&nbsp;{lineNum}: {origLine}
                  </div>
                );
                });
              })()}
            </div>
          </div>

          <div className="p-4 border-t border-[#1f1f1f] bg-[#0a0a0a] flex items-center justify-between font-mono text-xs">
            <button
              onClick={() => setDiffDrawerOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {behaviorResult && !behaviorResult.behavior_preserved && (
                <button
                  onClick={() => setShowForceApplyConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Force Apply Anyway</span>
                </button>
              )}
              <button
                onClick={() => handleApplySurgery({
                  filePath: diffData.file,
                  approvedLines: diffData.changed_lines,
                  originalSource: diffData.original_source,
                  transformedSource: diffData.transformed_source,
                })}
                disabled={applyingSurgery || behaviorVerifying || (behaviorResult !== null && !behaviorResult.behavior_preserved)}
                className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>Apply Surgery</span>
              </button>
            </div>
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

      {/* Force Apply Confirmation Dialog */}
      {showForceApplyConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-500/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Confirm Force Apply Surgery</span>
            </div>
            <p className="text-zinc-300 text-xs font-sans leading-relaxed">
              Behavioral verification detected behavioral divergence between original and transformed code. Applying surgery may alter program execution.
            </p>
            {behaviorResult?.differences && behaviorResult.differences.length > 0 && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-[11px] text-red-300 space-y-1">
                {behaviorResult.differences.map((d: string, idx: number) => (
                  <div key={idx}>• {d}</div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForceApplyConfirm(false)}
                className="px-4 py-2 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowForceApplyConfirm(false);
                  if (diffData) {
                    handleApplySurgery({
                      filePath: diffData.file,
                      approvedLines: diffData.changed_lines,
                      originalSource: diffData.original_source,
                      transformedSource: diffData.transformed_source,
                    });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg"
              >
                Force Apply Surgery
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onOpenFolder={handleOpenFolder}
        onRunTomography={() => activeTab && runAnalysis(activeTab)}
        onApplySafeRemove={handleOpenDiffPreview}
        onRestoreBackup={handleUndoSurgery}
        onToggleExplorer={() => setShowExplorer((prev) => !prev)}
        onToggleConsole={() => setShowConsole((prev) => !prev)}
        onRestoreRecoverySession={handleRestoreSession}
        onDiscardRecoverySession={handleDiscardRecovery}
        onOpenTestExplorer={() => setMainView("test_explorer")}
        onRunAllTests={testsHook.runAllTests}
        onRunCurrentFileTests={() => {
          if (activeTab) testsHook.runFileTests(activeTab.path);
        }}
        onOpenProfiler={() => setMainView("profiler")}
        onProfileCurrentFile={() => {
          if (activeTab) {
            profiler.profilePython(activeTab.content, activeTab.path);
            setMainView("profiler");
          }
        }}
        onProfileCurrentTest={() => {
          if (activeTab) {
            profiler.profilePython(activeTab.content, activeTab.path);
            setMainView("profiler");
          }
        }}
        onProfileTerminal={() => {
          if (activeTab) {
            profiler.profilePython(activeTab.content, activeTab.path);
            setMainView("profiler");
          }
        }}
        onExportProfiler={profiler.exportProfile}
        onClearProfilerDecorations={clearProfilerDecorations}
        onOpenSecurityAudit={() => setMainView("security_audit")}
        onRunSecurityScan={securityAudit.runScan}
        onExportSecurityReport={securityAudit.exportMarkdown}
        onCreateSnapshot={() => {
          snapshotHook.createSnapshot(
            `Snapshot ${new Date().toLocaleTimeString()}`,
            "Manual snapshot",
            openTabs,
            activeTabPath
          );
          showToast("Snapshot created successfully");
        }}
        onOpenSnapshots={() => setMainView("snapshots")}
        onCompareLatestSnapshot={() => {
          if (snapshotHook.snapshots.length > 0) {
            setMainView("snapshots");
            snapshotHook.compareSnapshot(snapshotHook.snapshots[0].id);
          }
        }}
        onRestoreLastSnapshot={() => {
          if (snapshotHook.snapshots.length > 0) {
            snapshotHook.restoreWorkspace(snapshotHook.snapshots[0].id);
            showToast(`Restored to ${snapshotHook.snapshots[0].name}`);
          }
        }}
        onOpenDashboard={() => setMainView("dashboard")}
        onOpenGraph={() => setMainView("graph")}
        onOpenClones={() => setMainView("clones")}
        onOpenFingerprint={() => setMainView("behavior_fingerprint")}
        onOpenFirewall={() => setMainView("patch_firewall")}
        onOpenIntentRadar={() => setMainView("semantic_intent_radar")}
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

      {/* Workspace Search Modal (Files, Content, Symbols) */}
      <WorkspaceSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        workspacePath={folderPath || "demo-workspaces/ai_cart_project"}
        initialMode={searchModalMode}
        initialQuery={searchModalQuery}
        onModeChange={setSearchModalMode}
        onQueryChange={setSearchModalQuery}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Safe Surgery Diff Preview Modal */}
      {showSurgeryDiffModal && activeTab && (
        <SurgeryDiffPreview
          filePath={activeTab.path}
          originalSource={activeTab.content}
          findings={findings}
          onApply={handleApplySurgery}
          onCancel={() => setShowSurgeryDiffModal(false)}
          isApplying={applyingSurgery}
        />
      )}

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

      {/* Surgery History Drawer */}
      <SurgeryHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        entries={historyEntries}
        onRefresh={refreshHistory}
        onRestore={(entry) => {
          setSelectedHistoryEvent(entry);
          setShowRestoreConfirmModal(true);
        }}
        onPreviewDiff={(entry) => {
          setDiffData({
            file: entry.file_path,
            original_source: entry.before_source,
            transformed_source: entry.after_source,
            changed_lines: entry.removed_lines,
            ghost_count_before: entry.removed_lines.length,
            ghost_count_after: 0,
            causal_luminance_after: entry.luminance_after,
          });
          setShowSurgeryDiffModal(true);
        }}
      />

      {/* Restore Checkpoint Confirmation Modal */}
      <RestoreConfirmModal
        isOpen={showRestoreConfirmModal}
        onClose={() => setShowRestoreConfirmModal(false)}
        entry={selectedHistoryEvent}
        onConfirmRestore={(id) => handleRestoreCheckpoint(id)}
        isRestoring={restoringHistory}
      />

      {/* Floating Inline AI Code Actions Toolbar */}
      <InlineCodeActions
        visible={!aiPanelOpen && !!selectionInfo && !!selectionInfo.text}
        x={selectionInfo?.x || 0}
        y={selectionInfo?.y || 0}
        onAction={handleRunAiCodeAction}
      />

      {/* Unified AI Panel */}
      <UnifiedAIPanel
        isOpen={aiPanelOpen}
        mode={aiPanelMode}
        onClose={() => setAiPanelOpen(false)}
        aiLoading={aiLoading}
        aiResponse={aiResponse}
        onApplyPatch={handleAiApplyPatch}
        onPreviewDiff={handleAiPreviewDiff}
        workspacePath={folderPath || ""}
        activeFilePath={activeTabPath}
        onAgentPreviewDiff={handleAgentPreviewDiff}
        onApplyStep={handleApplyAgentStep}
        onApplyAllApproved={handleApplyAllAgentApproved}
        runningCommandOutput={agentRunningCommandOutput}
      />

      {/* Crash Recovery & Session Restore Modal */}
      <RecoveryDialog
        isOpen={recoveryDialogOpen}
        snapshot={recoverySnapshot}
        wasCrash={wasCrashDetected}
        onRestore={handleRestoreSession}
        onDiscard={handleDiscardRecovery}
        onLater={() => setRecoveryDialogOpen(false)}
      />

    </div>
  );
}
