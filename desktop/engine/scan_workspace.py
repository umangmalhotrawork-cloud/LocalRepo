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

    for fpath in py_files:
        res = analyze_code(fpath)
        ghost_count = res.get("ghost_lines_count", 0)
        file_total = res.get("total_lines", 0)
        findings = res.get("findings", [])

        rel_path = os.path.relpath(fpath, abs_workspace)
        ghost_ratio = round(ghost_count / file_total, 4) if file_total > 0 else 0.0

        file_reports.append({
            "path": rel_path,
            "absolute_path": fpath,
            "ghost_lines": ghost_count,
            "total_lines": file_total,
            "ghost_ratio": ghost_ratio,
            "findings": findings
        })

        total_ghost_lines += ghost_count
        total_lines += file_total

    # Sort files by ghost_ratio descending, then ghost_lines descending
    file_reports.sort(key=lambda x: (x["ghost_ratio"], x["ghost_lines"]), reverse=True)

    overall_ghost_ratio = (
        round(total_ghost_lines / total_lines, 4) if total_lines > 0 else 0.0
    )

    return {
        "workspace": workspace_path,
        "files_scanned": len(file_reports),
        "total_ghost_lines": total_ghost_lines,
        "total_lines": total_lines,
        "ghost_ratio": overall_ghost_ratio,
        "files": file_reports
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Workspace-Wide AST Project Scanner")
    parser.add_argument("workspace", help="Path to workspace root directory")
    args = parser.parse_args()

    result = scan_workspace(args.workspace)
    print(json.dumps(result, indent=2))
