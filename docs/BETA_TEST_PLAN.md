# Echo Nullity — Beta Manual Test Plan

## 1. Scope & Objectives
This test plan validates all critical features and subsystems of Echo Nullity before the public beta release.

---

## 2. Test Cases

### 1. Editor & Monaco Integration
* **TC-ED-01**: Open single and multi-tab files (`.py`, `.ts`, `.json`, `.md`).
* **TC-ED-02**: Verify dirty unsaved indicators (`●` badge on tab).
* **TC-ED-03**: Verify `Cmd+S` saves file content atomically to disk.
* **TC-ED-04**: Verify syntax highlighting, auto-indentation, and bracket pairing.

### 2. Integrated Terminal Panel
* **TC-TM-01**: Toggle terminal using toolbar or shortcut (`Ctrl+\``).
* **TC-TM-02**: Execute basic shell commands (`ls`, `pwd`, `git status`).
* **TC-TM-03**: Resize terminal panel and verify layout responsiveness.

### 3. Git Version Control & Source Control Panel
* **TC-SC-01**: Open Source Control panel (`Cmd+Shift+G`).
* **TC-SC-02**: Stage and unstage modified files.
* **TC-SC-03**: Commit staged changes with commit message.
* **TC-SC-04**: Inspect visual file diffs in Monaco diff editor.

### 4. Workspace Search & Fast Text Search
* **TC-SR-01**: Open Workspace Search panel (`Cmd+Shift+F`).
* **TC-SR-02**: Search across codebase with regex, case-sensitivity, and file include/exclude patterns.
* **TC-SR-03**: Click search match to jump directly to target line in Monaco editor.

### 5. AI Actions & AI Autonomous Agent
* **TC-AI-01**: Select code block, press `Cmd+I` to trigger AI Explain.
* **TC-AI-02**: Trigger AI Refactor (`Cmd+Shift+R`) and preview diff before applying.
* **TC-AI-03**: Open AI Agent panel (`Cmd+Shift+I`) and run multi-step plan execution.

### 6. Time Travel Debugger & Provenance Replay
* **TC-DB-01**: Press `F5` on active Python file to launch time-travel debugger.
* **TC-DB-02**: Step forward (`F10`) and step backward (`Shift+F10`) inspecting call stack and local variable snapshots.

### 7. Performance Profiler
* **TC-PF-01**: Press `F7` on Python script to run `cProfile` and `tracemalloc`.
* **TC-PF-02**: Inspect flame-chart horizontal timeline, sortable hot-path table, and React component render table.
* **TC-PF-03**: Verify Monaco amber slow-line highlights.

### 8. Security & Dependency Audit
* **TC-SEC-01**: Press `Cmd+Shift+S` to run security audit.
* **TC-SEC-02**: Verify detection of vulnerable dependencies, hardcoded secrets, and risky patterns.
* **TC-SEC-03**: Verify Monaco red/amber gutter indicators and remediation tooltips.

### 9. Workspace Snapshots & Safe Rollback
* **TC-SN-01**: Press `Cmd+Shift+B` to create a named restore point.
* **TC-SN-02**: Compare snapshot against current disk state with side-by-side diff modal.
* **TC-SN-03**: Perform full workspace rollback and verify automatic pre-restore backup.

### 10. Crash Recovery & Session Persistence
* **TC-RC-01**: Check heartbeat background persistence and state saving to `workspace-state.json`.
* **TC-RC-02**: Verify recovery prompt restores open tabs, scroll positions, and unsaved contents upon abnormal shutdown.
