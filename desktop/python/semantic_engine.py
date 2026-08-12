import os
import sys
import json
from collections import defaultdict

# Ensure directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from semantic_clone import extract_semantic_candidates

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "venv",
    ".venv",
    ".git",
    "__pycache__",
    "dist",
    "build",
}

def find_semantic_clones(workspace_path: str) -> list[dict]:
    """
    Recursively scans all Python files in workspace_path, extracts semantic AST candidate fingerprints,
    and returns semantic clone groups with confidence scoring.
    """
    abs_workspace = os.path.abspath(workspace_path)
    groups_by_fp = defaultdict(list)

    for root, dirs, files in os.walk(abs_workspace):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            if file.endswith(".py"):
                abs_file_path = os.path.join(root, file)
                rel_file_path = os.path.relpath(abs_file_path, abs_workspace)

                try:
                    with open(abs_file_path, "r", encoding="utf-8") as f:
                        source_code = f.read()

                    candidates = extract_semantic_candidates(source_code)
                    for cand in candidates:
                        cand["file"] = rel_file_path
                        cand["absolute_path"] = abs_file_path
                        groups_by_fp[cand["semantic_fingerprint"]].append(cand)
                except Exception as e:
                    continue

    result_groups = []
    for fp, occurrences in groups_by_fp.items():
        if len(occurrences) >= 2:
            # High confidence (0.95 - 1.0) for semantic equivalence
            confidence = 0.95 if "Assign" in fp or "BoolOp" in fp else 0.90
            result_groups.append({
                "fingerprint": fp,
                "occurrences_count": len(occurrences),
                "confidence": confidence,
                "occurrences": occurrences,
            })

    # Sort groups in descending order by occurrences_count
    result_groups.sort(key=lambda g: g["occurrences_count"], reverse=True)
    return result_groups

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    clones = find_semantic_clones(target)
    print(json.dumps(clones, indent=2))
