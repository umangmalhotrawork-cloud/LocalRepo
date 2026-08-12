#!/usr/bin/env python3
import sys
import os
import json
import ast
import argparse

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".cache",
    ".vscode",
    "exports",
}

IGNORED_EXTENSIONS = {
    ".pyc",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".ico",
    ".lock",
    ".echo-nullity-backup",
    ".log",
}

def is_ignored_dir(d: str) -> bool:
    return d in IGNORED_DIRS or d.startswith(".") or d.startswith("EchoNullity-Report-")

def search_files(workspace_root: str, query: str, limit: int = 200) -> list:
    results = []
    q = query.lower().strip()

    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in files:
            if file.endswith(".echo-nullity-backup") or any(file.endswith(ext) for ext in IGNORED_EXTENSIONS):
                continue

            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, workspace_root)

            if not q or q in file.lower() or q in rel_path.lower():
                results.append({
                    "file": rel_path,
                    "absolute_path": abs_path,
                    "filename": file,
                    "line": 1,
                    "column": 1,
                    "preview": rel_path,
                    "match_type": "file",
                })
                if len(results) >= limit:
                    return results

    return results

def search_content(workspace_root: str, query: str, limit: int = 200) -> list:
    results = []
    if not query.strip():
        return []

    q = query.lower()

    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in files:
            if file.endswith(".echo-nullity-backup") or any(file.endswith(ext) for ext in IGNORED_EXTENSIONS):
                continue

            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, workspace_root)

            try:
                with open(abs_path, "r", encoding="utf-8", errors="ignore") as fh:
                    for line_num, line in enumerate(fh, start=1):
                        lower_line = line.lower()
                        idx = lower_line.find(q)
                        if idx != -1:
                            col = idx + 1
                            preview = line.strip()
                            results.append({
                                "file": rel_path,
                                "absolute_path": abs_path,
                                "filename": file,
                                "line": line_num,
                                "column": col,
                                "preview": preview,
                                "match_type": "content",
                            })
                            if len(results) >= limit:
                                return results
            except Exception:
                continue

    return results

def search_symbols(workspace_root: str, query: str, limit: int = 200) -> list:
    results = []
    q = query.lower().strip()

    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in files:
            if not file.endswith(".py") or file.endswith(".echo-nullity-backup"):
                continue

            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, workspace_root)

            try:
                with open(abs_path, "r", encoding="utf-8", errors="ignore") as fh:
                    source = fh.read()
                
                tree = ast.parse(source, filename=file)
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        sym_name = node.name
                        if not q or q in sym_name.lower():
                            results.append({
                                "file": rel_path,
                                "absolute_path": abs_path,
                                "filename": file,
                                "line": getattr(node, "lineno", 1),
                                "column": getattr(node, "col_offset", 0) + 1,
                                "preview": f"def {sym_name}(...)",
                                "match_type": "function",
                                "symbol": sym_name,
                            })
                    elif isinstance(node, ast.ClassDef):
                        sym_name = node.name
                        if not q or q in sym_name.lower():
                            results.append({
                                "file": rel_path,
                                "absolute_path": abs_path,
                                "filename": file,
                                "line": getattr(node, "lineno", 1),
                                "column": getattr(node, "col_offset", 0) + 1,
                                "preview": f"class {sym_name}:",
                                "match_type": "class",
                                "symbol": sym_name,
                            })

                    if len(results) >= limit:
                        return results
            except Exception:
                continue

    return results

def search_workspace(workspace_root: str, query: str = "", mode: str = "files", limit: int = 200) -> dict:
    abs_root = os.path.abspath(workspace_root)
    if not os.path.exists(abs_root):
        return {
            "workspace": workspace_root,
            "query": query,
            "mode": mode,
            "results_count": 0,
            "results": [],
            "error": f"Workspace directory does not exist: {workspace_root}",
        }

    if mode == "content":
        results = search_content(abs_root, query, limit)
    elif mode == "symbols":
        results = search_symbols(abs_root, query, limit)
    else:
        results = search_files(abs_root, query, limit)

    return {
        "workspace": workspace_root,
        "query": query,
        "mode": mode,
        "results_count": len(results),
        "results": results,
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            workspace = payload.get("workspace", os.getcwd())
            query = payload.get("query", "")
            mode = payload.get("mode", "files")
            limit = payload.get("limit", 200)
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON stdin: {e}"}))
            sys.exit(1)
    else:
        parser = argparse.ArgumentParser(description="Echo Nullity Workspace Search Engine")
        parser.add_argument("workspace", nargs="?", default=".", help="Workspace root directory")
        parser.add_argument("--query", "-q", default="", help="Search query")
        parser.add_argument("--mode", "-m", choices=["files", "content", "symbols"], default="files", help="Search mode")
        parser.add_argument("--limit", "-l", type=int, default=200, help="Max results")
        args = parser.parse_args()
        workspace = args.workspace
        query = args.query
        mode = args.mode
        limit = args.limit

    output = search_workspace(workspace, query, mode, limit)
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
