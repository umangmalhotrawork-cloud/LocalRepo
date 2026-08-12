#!/usr/bin/env python3
import sys
import os
import json
import argparse

# Ensure engine directory is in path to import analyze
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from analyze import analyze_code

EXCLUDE_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
    ".next",
    "venv",
    ".venv",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

def scan_workspace(workspace_path):
    abs_workspace = os.path.abspath(workspace_path)
    if not os.path.exists(abs_workspace):
        return {
            "error": f"Workspace directory not found: {workspace_path}",
            "workspace": workspace_path,
            "files_scanned": 0,
            "total_ghost_lines": 0,
            "total_lines": 0,
            "ghost_ratio": 0.0,
            "files": []
        }

    py_files = []
    for root, dirs, files in os.walk(abs_workspace):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        for f in sorted(files):
            if f.endswith(".py"):
                py_files.append(os.path.join(root, f))

    file_reports = []
    total_ghost_lines = 0
    total_lines = 0

    import time
    start_time = time.perf_counter()

    for fpath in py_files:
        res = analyze_code(fpath)
        ghost_count = res.get("ghost_lines_count", 0)
        file_total = res.get("total_lines", 0)
        findings = res.get("findings", [])
        luminance = res.get("causal_luminance", 0.0 if ghost_count > 0 else 1.0)

        rel_path = os.path.relpath(fpath, abs_workspace)
        ghost_ratio = round(ghost_count / file_total, 4) if file_total > 0 else 0.0

        file_reports.append({
            "path": rel_path,
            "absolute_path": fpath,
            "ghost_lines": ghost_count,
            "total_lines": file_total,
            "ghost_ratio": ghost_ratio,
            "causal_luminance": luminance,
            "findings": findings
        })

        total_ghost_lines += ghost_count
        total_lines += file_total

    # Sort files by ghost_lines descending, then ghost_ratio descending
    file_reports.sort(key=lambda x: (x["ghost_lines"], x["ghost_ratio"]), reverse=True)

    scan_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    risky_files_count = sum(1 for f in file_reports if f["ghost_lines"] > 0)
    safe_removals_count = sum(len(f["findings"]) for f in file_reports)
    
    avg_luminance = (
        round(sum(f.get("causal_luminance", 1.0) for f in file_reports) / len(file_reports), 2)
        if file_reports else 1.0
    )
    overall_ghost_ratio = (
        round(total_ghost_lines / total_lines, 4) if total_lines > 0 else 0.0
    )

    return {
        "workspace": workspace_path,
        "files_scanned": len(file_reports),
        "total_ghost_lines": total_ghost_lines,
        "total_lines": total_lines,
        "ghost_ratio": overall_ghost_ratio,
        "average_causal_luminance": avg_luminance,
        "risky_files_count": risky_files_count,
        "safe_removals_count": safe_removals_count,
        "scan_duration_ms": scan_duration_ms,
        "files": file_reports
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Workspace-Wide AST Project Scanner")
    parser.add_argument("workspace", help="Path to workspace root directory")
    args = parser.parse_args()

    result = scan_workspace(args.workspace)
    print(json.dumps(result, indent=2))
