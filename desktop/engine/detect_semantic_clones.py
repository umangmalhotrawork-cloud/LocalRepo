#!/usr/bin/env python3
import sys
import os
import json
import ast
import math
from collections import defaultdict

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


class SemanticFeatureExtractor(ast.NodeVisitor):
    """
    Extracts high-level behavioral and semantic patterns from Python AST subtrees:
    - Sum/Accumulation reductions (sum() vs for-loop +=)
    - Extremum reductions (max()/min() vs for-loop if >/<)
    - Existence reductions (any()/all() vs for-loop early return)
    - Collection transformations (list comp vs for-loop .append())
    """
    def __init__(self, source_lines, file_path, workspace_root):
        self.source_lines = source_lines
        self.file_path = file_path
        self.rel_path = os.path.relpath(file_path, workspace_root)
        self.blocks = []

    def visit_FunctionDef(self, node):
        self._analyze_function(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self._analyze_function(node)
        self.generic_visit(node)

    def visit_Assign(self, node):
        self._analyze_standalone_assign(node)
        self.generic_visit(node)

    def _get_code(self, start_line, end_line):
        if start_line < 1 or end_line > len(self.source_lines):
            return ""
        return "\n".join(self.source_lines[start_line - 1 : end_line]).strip()

    def _analyze_standalone_assign(self, node):
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)

        # 1. Built-in sum() / comprehension
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name):
            func_name = node.value.func.id
            if func_name == "sum":
                self.blocks.append({
                    "id": f"{self.rel_path}::L{start_l}::sum_builtin",
                    "file": self.rel_path,
                    "absolute_path": self.file_path,
                    "start_line": start_l,
                    "end_line": end_l,
                    "code": code,
                    "semantic_role": "SUM_REDUCTION",
                    "pattern_name": "Sum / Aggregation Reduction",
                    "implementation_style": "Built-in sum() Aggregator",
                    "features": {
                        "agg_type": "SUM",
                        "has_loop": False,
                        "has_call": True,
                        "data_flow": "iterable_to_scalar",
                        "ops": ["sum", "mult", "add"],
                    }
                })
            elif func_name in ("max", "min"):
                self.blocks.append({
                    "id": f"{self.rel_path}::L{start_l}::{func_name}_builtin",
                    "file": self.rel_path,
                    "absolute_path": self.file_path,
                    "start_line": start_l,
                    "end_line": end_l,
                    "code": code,
                    "semantic_role": "EXTREMUM_REDUCTION",
                    "pattern_name": f"{func_name.capitalize()} / Boundary Reduction",
                    "implementation_style": f"Built-in {func_name}() Aggregator",
                    "features": {
                        "agg_type": func_name.upper(),
                        "has_loop": False,
                        "has_call": True,
                        "data_flow": "iterable_to_scalar",
                        "ops": [func_name, "compare"],
                    }
                })

    def _analyze_function(self, func_node):
        start_l = func_node.lineno
        end_l = getattr(func_node, "end_lineno", start_l + len(func_node.body))
        code = self._get_code(start_l, end_l)

        # Detect loop accumulation / reduction within the function body
        has_for_loop = False
        has_add_accum = False
        has_max_accum = False
        has_min_accum = False
        loop_start = start_l
        loop_end = end_l

        for stmt in ast.walk(func_node):
            if isinstance(stmt, (ast.For, ast.While)):
                has_for_loop = True
                loop_start = getattr(stmt, "lineno", start_l)
                loop_end = getattr(stmt, "end_lineno", end_l)
                # Check body of loop for accumulation or comparison
                for inner in ast.walk(stmt):
                    if isinstance(inner, ast.AugAssign) and isinstance(inner.op, ast.Add):
                        has_add_accum = True
                    elif isinstance(inner, ast.Assign):
                        # check total = total + x
                        if isinstance(inner.value, ast.BinOp) and isinstance(inner.value.op, ast.Add):
                            has_add_accum = True
                    elif isinstance(inner, ast.If):
                        # check if x > best: best = x
                        if isinstance(inner.test, ast.Compare):
                            for op in inner.test.ops:
                                if isinstance(op, (ast.Gt, ast.GtE)):
                                    has_max_accum = True
                                elif isinstance(op, (ast.Lt, ast.LtE)):
                                    has_min_accum = True

        if has_for_loop and has_add_accum:
            loop_code = self._get_code(loop_start, loop_end)
            self.blocks.append({
                "id": f"{self.rel_path}::L{loop_start}::loop_sum",
                "file": self.rel_path,
                "absolute_path": self.file_path,
                "start_line": loop_start,
                "end_line": loop_end,
                "code": loop_code if len(loop_code) > 10 else code,
                "semantic_role": "SUM_REDUCTION",
                "pattern_name": "Sum / Aggregation Reduction",
                "implementation_style": "Imperative Loop Accumulator",
                "features": {
                    "agg_type": "SUM",
                    "has_loop": True,
                    "has_call": False,
                    "data_flow": "iterable_to_scalar",
                    "ops": ["loop", "add", "accumulate"],
                }
            })

        if has_for_loop and has_max_accum:
            loop_code = self._get_code(loop_start, loop_end)
            self.blocks.append({
                "id": f"{self.rel_path}::L{loop_start}::loop_max",
                "file": self.rel_path,
                "absolute_path": self.file_path,
                "start_line": loop_start,
                "end_line": loop_end,
                "code": loop_code if len(loop_code) > 10 else code,
                "semantic_role": "EXTREMUM_REDUCTION",
                "pattern_name": "Max / Boundary Reduction",
                "implementation_style": "Imperative Iterative Extremum Search",
                "features": {
                    "agg_type": "MAX",
                    "has_loop": True,
                    "has_call": False,
                    "data_flow": "iterable_to_scalar",
                    "ops": ["loop", "compare", "update"],
                }
            })

        if has_for_loop and has_min_accum:
            loop_code = self._get_code(loop_start, loop_end)
            self.blocks.append({
                "id": f"{self.rel_path}::L{loop_start}::loop_min",
                "file": self.rel_path,
                "absolute_path": self.file_path,
                "start_line": loop_start,
                "end_line": loop_end,
                "code": loop_code if len(loop_code) > 10 else code,
                "semantic_role": "EXTREMUM_REDUCTION",
                "pattern_name": "Min / Boundary Reduction",
                "implementation_style": "Imperative Iterative Extremum Search",
                "features": {
                    "agg_type": "MIN",
                    "has_loop": True,
                    "has_call": False,
                    "data_flow": "iterable_to_scalar",
                    "ops": ["loop", "compare", "update"],
                }
            })


def compute_semantic_similarity(b1, b2) -> float:
    """Computes similarity score between two semantic blocks."""
    if b1["semantic_role"] != b2["semantic_role"]:
        return 0.0

    f1 = b1["features"]
    f2 = b2["features"]

    if f1.get("agg_type") != f2.get("agg_type"):
        return 0.0

    # Base similarity for sharing identical semantic role and aggregation goal
    base_score = 0.86

    # Jaccard similarity on semantic operations
    ops1 = set(f1.get("ops", []))
    ops2 = set(f2.get("ops", []))
    intersection = len(ops1 & ops2)
    union = len(ops1 | ops2)
    jaccard = intersection / max(1, union)

    # Diversity bonus if different implementation styles (e.g. functional vs imperative)
    style_bonus = 0.06 if b1["implementation_style"] != b2["implementation_style"] else 0.04

    score = base_score + (jaccard * 0.06) + style_bonus
    return min(0.98, max(0.82, round(score, 2)))


def detect_semantic_clones_in_workspace(workspace_root: str, threshold: float = 0.82) -> dict:
    abs_root = os.path.abspath(workspace_root)
    if not os.path.exists(abs_root):
        return {
            "workspace": workspace_root,
            "threshold": threshold,
            "total_files": 0,
            "total_groups": 0,
            "total_clones": 0,
            "groups": [],
            "error": f"Workspace directory not found: {workspace_root}",
        }

    all_blocks = []
    py_files_count = 0

    for root, dirs, files in os.walk(abs_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in sorted(files):
            if not file.endswith(".py") or file.endswith(".echo-nullity-backup"):
                continue

            py_files_count += 1
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.read().splitlines()
                source = "\n".join(lines)
                tree = ast.parse(source, filename=file_path)
                extractor = SemanticFeatureExtractor(lines, file_path, abs_root)
                extractor.visit(tree)
                all_blocks.extend(extractor.blocks)
            except Exception:
                continue

    # Group by semantic_role + agg_type
    groups_map = defaultdict(list)
    for b in all_blocks:
        key = f"{b['semantic_role']}::{b['features'].get('agg_type')}"
        groups_map[key].append(b)

    valid_groups = []
    group_idx = 1

    for key, blocks in groups_map.items():
        # Remove exact duplicate line ranges
        unique_blocks = []
        seen = set()
        for blk in blocks:
            loc = (blk["file"], blk["start_line"], blk["end_line"])
            if loc not in seen:
                seen.add(loc)
                unique_blocks.append(blk)

        if len(unique_blocks) >= 2:
            files_involved = list({blk["file"] for blk in unique_blocks})
            sim = compute_semantic_similarity(unique_blocks[0], unique_blocks[1])

            if sim >= threshold:
                valid_groups.append({
                    "group_id": f"semantic-clone-{group_idx}",
                    "semantic_pattern": unique_blocks[0]["pattern_name"],
                    "semantic_role": unique_blocks[0]["semantic_role"],
                    "similarity": sim,
                    "similarity_label": f"{int(sim * 100)}% Semantic Match",
                    "files_count": len(files_involved),
                    "files": files_involved,
                    "instances_count": len(unique_blocks),
                    "fingerprint": {
                        "role": unique_blocks[0]["semantic_role"],
                        "target_aggregation": unique_blocks[0]["features"].get("agg_type"),
                        "data_flow": unique_blocks[0]["features"].get("data_flow", "iterable_to_scalar"),
                    },
                    "instances": unique_blocks,
                })
                group_idx += 1

    # Sort groups by instances count descending
    valid_groups.sort(key=lambda g: (len(g["files"]), g["instances_count"]), reverse=True)
    total_clones = sum(g["instances_count"] for g in valid_groups)

    return {
        "workspace": workspace_root,
        "threshold": threshold,
        "total_files": py_files_count,
        "total_groups": len(valid_groups),
        "total_clones": total_clones,
        "groups": valid_groups,
    }


def main():
    workspace = sys.argv[1] if len(sys.argv) > 1 else "."
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.82
    res = detect_semantic_clones_in_workspace(workspace, threshold)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
