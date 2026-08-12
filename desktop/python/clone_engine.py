#!/usr/bin/env python3
"""
Workspace Structural Clone Detection Engine.
Recursively scans workspace Python files, extracts structural candidates,
and groups occurrences by identical AST fingerprints.
"""

import sys
import os
import json
from collections import defaultdict

# Add parent directory to path to support local imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from structural_clone import extract_clone_candidates

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


def is_ignored_dir(d: str) -> bool:
    return d in IGNORED_DIRS or d.startswith(".") or d.startswith("EchoNullity-Report-")


def find_structural_clones(workspace_path: str) -> list[dict]:
    """
    Recursively scans the workspace for .py files, extracts normalized AST candidates,
    groups them by structural fingerprint, and returns clone groups having 2+ occurrences.
    """
    abs_workspace = os.path.abspath(workspace_path)
    if not os.path.exists(abs_workspace):
        return []

    fingerprint_groups = defaultdict(list)

    for root, dirs, files in os.walk(abs_workspace):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]

        for file in sorted(files):
            if not file.endswith(".py") or file.endswith(".echo-nullity-backup"):
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, abs_workspace)

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    source = fh.read()

                candidates = extract_clone_candidates(source)
                for cand in candidates:
                    fingerprint_groups[cand["fingerprint"]].append({
                        "file": rel_path,
                        "absolute_path": file_path,
                        "start_line": cand["start_line"],
                        "end_line": cand["end_line"],
                        "code": cand["code"],
                        "kind": cand["kind"],
                    })
            except Exception as e:
                continue

    # Filter only groups with 2 or more occurrences
    clone_groups = []
    for fp, occurrences in fingerprint_groups.items():
        if len(occurrences) >= 2:
            # Deduplicate multiple exact duplicates on identical file+line if any
            unique_occ = []
            seen = set()
            for occ in occurrences:
                key = (occ["file"], occ["start_line"], occ["end_line"])
                if key not in seen:
                    seen.add(key)
                    unique_occ.append(occ)

            if len(unique_occ) >= 2:
                clone_groups.append({
                    "fingerprint": fp,
                    "occurrences_count": len(unique_occ),
                    "occurrences": unique_occ,
                })

    # Sort groups by descending occurrence count, then by fingerprint
    clone_groups.sort(key=lambda g: (-g["occurrences_count"], g["fingerprint"]))

    return clone_groups


def main():
    workspace = sys.argv[1] if len(sys.argv) > 1 else "."
    results = find_structural_clones(workspace)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
