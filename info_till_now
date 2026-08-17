# Echo Nullity — Comprehensive Technical & Functional Architecture Document

> **Note for AI Models / GLM Chat**: This document contains the complete, authoritative specification, architecture, technical breakdown, UI structure, feature catalog, IPC channel directory, and engine mechanics of the **Echo Nullity** codebase up to the present milestone.

---

## 1. Executive Summary & Core Identity

**Echo Nullity** is a next-generation, causally-aware Desktop IDE engineered specifically for deep AST code analysis, non-destructive code surgery, time-travel debugging, and AI-assisted refactoring.

### Primary UX Philosophy
* **"SIMPLE BY DEFAULT. POWERFUL WHEN NEEDED."**
* **Code First**: When opening a file, Monaco Editor dominates 95–100% of the screen. All analysis telemetry, heatmaps, bottom drawers, and tomography panels remain **CLOSED** until explicitly requested.
* **Contextual Disclosure**: Secondary panels (Terminal, Debug Console, Tomography, AST Surgery Diff) open only in response to explicit user triggers or active runtime events.

---

## 2. Technology Stack & Frameworks

| Layer | Technologies & Frameworks |
| :--- | :--- |
| **Desktop Shell** | Electron (v33.2.1), Node.js, `node-pty` (Native Pseudo-Terminal) |
| **Frontend UI** | Next.js 15.5 (React 19, TypeScript 5.7), Tailwind CSS v3.4, Framer Motion |
| **Code Editor** | Monaco Editor (`@monaco-editor/react` v4.6), Tree-sitter tokenization, Custom Gutter Decorators |
| **AST Analysis Engine** | Python 3 AST (`ast`, `dis`), Pyodide, Rust AST tools, Node.js engine scripts (`desktop/engine/`) |
| **Version Control** | `simple-git` v3.36 (Integrated Git diff viewer, branch switcher, staging manager) |
| **Styling & Icons** | Dark Mode Theme (`#050505`, `#0a0a0d`, `#1f1f24`), Lucide React icons |

---

## 3. High-Frequency UI & Information Architecture

The UI is structured into 4 primary regions designed for zero cognitive clutter:

```
┌──────────────────────────────────────────────────────────────┐
│ Echo Nullity     Open   Save          Run        AI  ⌘K  ⋯   │
├──┬───────────────────────────────────────────────────────────┤
│  │                                                           │
│A │                                                           │
│C │                       MONACO EDITOR                       │
│T │                      (Code Dominant)                      │
│I │                                                           │
│V │                                                           │
│I │                                                           │
│T │                                                           │
│Y │                                                           │
│  │                                                           │
├──┴───────────────────────────────────────────────────────────┤
│ Status: checkout_engine.py    Python    Ready      Ln 15, Col 4  │
└──────────────────────────────────────────────────────────────┘
```

### A. Top Navigation Bar (Quiet Header)
* **Left Zone**: Branding (`Echo Nullity`), Workspace `[Open]` button, File `[Save]` button.
* **Center Zone**: Contextual Execution Control (`[▶ Run]` / `[▶ Run Python]` / `[▶ Run JavaScript]`).
  * *Contextual Debug Transformation*: When debugging starts, the Run button transforms into `[■ Stop]`, `[↻ Restart]`, `[Step]`. When debugging is inactive, no permanent Debug button occupies space.
* **Right Zone**: `[✨ AI]` Gateway, `[⌘K]` Command Palette button, and `[⋯]` More Menu dropdown (housing Profiler, Security Audit, Snapshots, and Report Export).

### B. Quiet 40px Left Activity Rail
Contains **exactly 4 primary icons** with hover tooltips:
1. `📁 Explorer` (`⌘B`) — Toggles File Tree sidebar.
2. `🔍 Search` (`⌘⇧F`) — Toggles Workspace Search & Replace panel.
3. `🌿 Source Control` (`⌘⇧G`) — Toggles Git staging and diff drawer.
4. `📈 Analysis` — Toggles Causal Analysis & Tomography Inspector (with live ghost line badge count).

### C. Monaco Editor Workspace (Center Pane)
* Reclaims 95–100% of workspace width and height on startup.
* Multi-tab file routing, line numbers, syntax highlighting, minimap, auto-indent, search widget, and inline AST action hints (`[Zap] Safe Remove`).

### D. Closed-by-Default Secondary Panels
* **Right Tomography Panel (`showRightPanel`)**: Default `false`. Opens on demand for deep AST analysis. Includes a top-right `[X]` close button.
* **Bottom Terminal Drawer (`showTerminalPanel`)**: Default `false`. Opens on demand or during execution/debugging/testing.
* **Gutter Heatmap Strip (`CodeEditorPanel`)**: Default `hidden`. Renders under Monaco only when Tomography Analysis is active.

### E. Minimal Status Bar
* Displays File Name, Language Mode, Analyzer Status, Git Branch, Debugger State, Cursor Position, and Save status.

---

## 4. Comprehensive Feature Catalog

### 1. Causal Tomography & Ghost Line Detection
* **Vacuous Ghost Lines**: Identifies lines of code that execute at runtime but produce zero causal effect on program output, state mutations, or return values.
* **Luminance Scoring**: Calculates causal relevance for every statement on a scale of $0.00$ (completely vacuous ghost line) to $1.00$ (critical causal node).
* **Gutter Heatmap**: Visual indicator mapping statement luminance directly onto Monaco Editor line gutters.

### 2. AST Safe Remove & Surgery Preview
* **Safe Remove Engine (`apply_surgery.py`, `undo_surgery.py`)**: AST-aware removal of dead/ghost code without breaking program syntax, indents, or control flow.
* **Surgery Diff Preview Modal (`SurgeryDiffPreview.tsx`)**: Displays side-by-side syntax-highlighted diffs before surgery is committed.
* **Embedded Trigger**: `[Apply Surgery]` button lives **ONLY** inside the active diff preview modal, preventing accidental deletions.
* **1-Click Undo**: Complete rollback mechanism for past AST surgeries.

### 3. Provenance Replay & Causal Traceback
* **Provenance Timeline (`ProvenanceReplayPanel.tsx`)**: Reconstructs the exact chain of assignments, function calls, and state mutations that led to a specific statement's execution.

### 4. Causal Impact & Behavioral Blast Radius
* **Impact Radius Engine (`behavioral_impact_radius.js`)**: Computes which downstream variables, functions, and files will be impacted if a given function or line is modified.
* **Blast Radius Engine (`behavioral_blast_radius.js`)**: Predicts system-wide fallout before committing a code change.

### 5. Counterfactual Execution Engine
* **Counterfactual Evaluation (`counterfactual_engine.js`)**: Answers "What if variable X had value Y?" by simulating AST modification outcomes without altering source files on disk.

### 6. Patch Firewall & Repository Patch Firewall
* **Patch Firewall (`PatchFirewallPanel.tsx`, `ai_patch_firewall.js`)**: Pre-flight verification for code patches. Analyzes incoming patches for regression risk, new ghost line creation, or intent drift.
* **Repo Firewall (`RepositoryPatchFirewallPanel.tsx`)**: Multi-file repository-level patch safety verification.

### 7. Semantic Intent Drift Radar
* **Semantic Intent Radar (`SemanticIntentRadarPanel.tsx`, `semantic_intent_drift.js`)**: Detects divergence between developer docstrings/comments and actual AST execution logic.

### 8. Structural & Semantic Clone Detection
* **Structural Clones (`ClonePanel.tsx`, `detect_clones.py`)**: Finds duplicate AST subtrees across the codebase.
* **Semantic Clones (`SemanticClonePanel.tsx`, `detect_semantic_clones.py`)**: Identifies functions that perform identical computations despite different variable naming or code structure.

### 9. Behavior Fingerprinting & Equivalence
* **Behavior Fingerprint (`BehaviorFingerprintPanel.tsx`, `behavior_fingerprint.py`)**: Generates mathematical fingerprints of runtime behavior to prove functional equivalence across refactored code blocks.

### 10. Time-Travel Debugger
* **Time-Travel Debugger (`DebuggerPanel.tsx`, `test_timeTravelDebugger.js`)**:
  * Step forward and backward through execution history.
  * Live call stack inspection, variable scope watch, and active execution line highlights.

### 11. Integrated Test Explorer & Runner
* **Test Explorer (`TestExplorerPanel.tsx`, `testManager.js`)**: Automatically discovers Python (`pytest`/`unittest`) and JavaScript test suites, executes them, and displays pass/fail telemetry with stack trace inspection.

### 12. Performance Profiler
* **Profiler (`ProfilerPanel.tsx`, `profilerManager.js`)**: CPU and memory profiling, line-by-line execution latency breakdown, and flame graphs.

### 13. Security Audit System
* **Security Auditor (`SecurityAuditPanel.tsx`, `securityAuditManager.js`)**: Static analysis scanner identifying vulnerabilities (SQL injection, hardcoded secrets, unsafe `eval`, shell injection, buffer flaws).

### 14. Workspace Snapshots & Disaster Recovery
* **Snapshots (`SnapshotPanel.tsx`, `snapshotManager.js`)**: Point-in-time workspace backups.
* **Snapshot Diff (`SnapshotDiffModal.tsx`)**: Compare current workspace state against any historical snapshot.
* **Crash Recovery (`RecoveryDialog.tsx`, `recoveryStore.js`)**: Auto-saves uncommitted state and recovers sessions cleanly after unexpected crashes.

### 15. AI Agent Integration
* **Autonomous AI Agent (`AgentPanel.tsx`, `AIPanel.tsx`, `agentManager.js`, `aiManager.js`)**: AI-driven coding assistant capable of multi-file refactoring, AST surgery recommendations, code generation, and codebase Q&A.

### 16. Command Palette & Quick Open
* **Command Palette (`CommandPalette.tsx`)**: `⌘K` overlay exposing 100% of IDE operations across 10 categories (File, Edit, Run, Debug, Tests, Git, Analysis, Tomography, Surgery, AI, View).
* **Quick Open (`QuickOpen.tsx`)**: `⌘P` file search dialog.

---

## 5. File & Directory Structure

```
Echo Nullity/
├── desktop/
│   ├── electron/               # Electron Main Process & IPC Managers
│   │   ├── main.js             # Window management, IPC handlers, app lifecycle
│   │   ├── preload.js          # Secure contextBridge API bindings
│   │   ├── agentManager.js     # AI Agent IPC handler
│   │   ├── aiManager.js        # AI LLM prompt & completion manager
│   │   ├── gitManager.js       # Git operations wrapper (simple-git)
│   │   ├── profilerManager.js  # Performance profiler engine binding
│   │   ├── ptyManager.js       # Native terminal manager (node-pty)
│   │   ├── recoveryStore.js    # Crash recovery & state persistence
│   │   ├── securityAuditManager.js # Security scanner IPC engine
│   │   ├── snapshotManager.js  # Workspace snapshot manager
│   │   └── testManager.js      # Test discovery and runner engine
│   │
│   ├── engine/                 # AST & Analysis Engine Scripts
│   │   ├── analyze.py          # Primary Python AST analyzer & ghost finder
│   │   ├── apply_surgery.py    # AST Safe Removal surgery applicator
│   │   ├── undo_surgery.py     # Surgery rollback engine
│   │   ├── calculate_luminance.py # Statement luminance calculator
│   │   ├── build_workspace_graph.py # Workspace dependency graph builder
│   │   ├── detect_clones.py    # Structural clone detector
│   │   ├── detect_semantic_clones.py # Semantic clone detector
│   │   ├── behavior_fingerprint.py # Runtime behavior fingerprint engine
│   │   ├── ai_patch_firewall.js # Patch safety & firewall evaluator
│   │   ├── behavioral_impact_radius.js # Impact radius calculation
│   │   ├── behavioral_blast_radius.js # Blast radius simulator
│   │   ├── counterfactual_engine.js # Counterfactual execution evaluator
│   │   ├── semantic_intent_drift.js # Docstring vs AST intent drift radar
│   │   └── js_analyzer.js      # JavaScript AST parser & analyzer
│   │
│   └── renderer/               # React UI & Monaco Components
│       ├── IDEApp.tsx          # Main IDE layout, state orchestration & routing
│       ├── hooks/              # Custom React state hooks (e.g. useWorkspaceState)
│       └── components/         # 34 Specialized React Components
│           ├── AgentPanel.tsx  # AI Agent chat & task interface
│           ├── BehaviorFingerprintPanel.tsx # Behavior comparison panel
│           ├── ClonePanel.tsx  # Structural clone viewer
│           ├── CodeEditorPanel.tsx # Gutter heatmap & luminance strip
│           ├── CommandPalette.tsx # ⌘K Command palette modal
│           ├── DebuggerPanel.tsx # Time-travel debugger UI
│           ├── LiveWebPreviewPanel.tsx # Live HTML/JS preview frame
│           ├── PatchFirewallPanel.tsx # Patch firewall report panel
│           ├── ProfilerPanel.tsx # Flame graph & CPU profiler UI
│           ├── ProvenanceReplayPanel.tsx # Causal step playback panel
│           ├── SecurityAuditPanel.tsx # Vulnerability report panel
│           ├── SemanticClonePanel.tsx # Semantic clone inspector
│           ├── SemanticIntentRadarPanel.tsx # Intent drift radar panel
│           ├── SnapshotPanel.tsx # Snapshot manager panel
│           ├── SourceControlPanel.tsx # Git staging & diff UI
│           ├── SurgeryDiffPreview.tsx # AST Surgery diff preview modal
│           ├── TerminalPanel.tsx # Integrated terminal, output & debug console
│           ├── TestExplorerPanel.tsx # Test suite explorer & runner UI
│           └── WorkspaceDashboard.tsx # Project overview & health dashboard
│
├── src/                        # Next.js Application Routes
│   └── app/
│       ├── desktop/page.tsx    # Entry point rendering IDEApp.tsx
│       ├── architecture/page.tsx # System architecture documentation page
│       ├── demo/page.tsx       # Live web demo view
│       └── docs/page.tsx       # User documentation page
│
├── package.json                # Project dependencies & npm scripts
└── tsconfig.json               # TypeScript compiler configuration
```

---

## 6. IPC Channel Index (`preload.js` -> `main.js`)

Below is the dictionary of IPC bridge methods available to the renderer via `window.electronAPI`:

* `openFolder()` — Triggers native OS folder picker.
* `readFile(path)` / `writeFile(path, content)` — File filesystem operations.
* `runTomography(file)` — Triggers AST analysis & ghost detection.
* `applySafeRemove(file, line)` — Applies AST Safe Removal surgery.
* `undoSurgery(file)` — Undoes last AST surgery.
* `executePython(file)` — Executes Python script in subprocess.
* `runDebugger(file)` — Launches Time-Travel Debugger session.
* `runTests(filter)` — Executes test suites via `testManager`.
* `gitStatus()` / `gitStage(file)` / `gitCommit(msg)` — Git operations.
* `createTerminal(cwd)` / `sendTerminalInput(id, data)` — `node-pty` terminal instances.
* `runSecurityScan()` — Triggers security audit.
* `runProfiler()` — Triggers performance profiler.
* `createSnapshot(name)` / `restoreSnapshot(id)` — Snapshot management.
* `askAI(prompt, context)` — Triggers AI completion/agent workflow.

---

## 7. Verification Status

* **TypeScript Type Safety**: Verified with `npx tsc --noEmit` (**0 errors**).
* **Production Build**: Verified with `npm run build` (**Next.js 15.5 compiled successfully**).
* **UI State Verification**: Monaco Editor occupies ~97% of screen width on default startup (`edit=1400px` / `exp=closed` / `ana=closed`). All advanced capabilities reveal contextually on demand.
