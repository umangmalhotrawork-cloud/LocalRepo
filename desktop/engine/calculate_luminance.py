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


def is_identity_operation(node: ast.AST) -> tuple[bool, str]:
    """
    Detects if an AST Assign or AugAssign represents an algebraic identity no-op.
    """
    if isinstance(node, ast.Assign):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            target_id = node.targets[0].id
            val = node.value

            # self assign: x = x
            if isinstance(val, ast.Name) and val.id == target_id:
                return True, f"Redundant self-assignment ({target_id} = {target_id})"

            # Binary operations: x = x op C
            if isinstance(val, ast.BinOp):
                left = val.left
                right = val.right
                op = val.op

                # Multiplication: x = x * 1 or 1 * x
                if isinstance(op, ast.Mult):
                    if isinstance(left, ast.Name) and left.id == target_id:
                        if isinstance(right, ast.Constant) and right.value == 1:
                            return True, "Identity multiplication (x * 1)"
                    if isinstance(right, ast.Name) and right.id == target_id:
                        if isinstance(left, ast.Constant) and left.value == 1:
                            return True, "Identity multiplication (1 * x)"

                # Addition: x = x + 0 or 0 + x
                elif isinstance(op, ast.Add):
                    if isinstance(left, ast.Name) and left.id == target_id:
                        if isinstance(right, ast.Constant) and right.value == 0:
                            return True, "Identity addition (x + 0)"
                    if isinstance(right, ast.Name) and right.id == target_id:
                        if isinstance(left, ast.Constant) and left.value == 0:
                            return True, "Identity addition (0 + x)"

                # Subtraction: x = x - 0
                elif isinstance(op, ast.Sub):
                    if isinstance(left, ast.Name) and left.id == target_id:
                        if isinstance(right, ast.Constant) and right.value == 0:
                            return True, "Identity subtraction (x - 0)"

                # Division: x = x / 1
                elif isinstance(op, (ast.Div, ast.FloorDiv)):
                    if isinstance(left, ast.Name) and left.id == target_id:
                        if isinstance(right, ast.Constant) and right.value == 1:
                            return True, "Identity division (x / 1)"

    elif isinstance(node, ast.AugAssign):
        if isinstance(node.target, ast.Name):
            op = node.op
            val = node.value
            if isinstance(op, ast.Add) and isinstance(val, ast.Constant) and val.value == 0:
                return True, "Identity aug-addition (+= 0)"
            if isinstance(op, ast.Sub) and isinstance(val, ast.Constant) and val.value == 0:
                return True, "Identity aug-subtraction (-= 0)"
            if isinstance(op, ast.Mult) and isinstance(val, ast.Constant) and val.value == 1:
                return True, "Identity aug-multiplication (*= 1)"
            if isinstance(op, (ast.Div, ast.FloorDiv)) and isinstance(val, ast.Constant) and val.value == 1:
                return True, "Identity aug-division (/= 1)"

    return False, ""


class LuminanceVisitor(ast.NodeVisitor):
    def __init__(self, source_lines, file_path, workspace_root):
        self.source_lines = source_lines
        self.file_path = file_path
        self.rel_path = os.path.relpath(file_path, workspace_root)
        self.statements = []
        self.return_vars = set()

    def _get_code(self, start_l, end_l):
        if start_l < 1 or end_l > len(self.source_lines):
            return ""
        return "\n".join(self.source_lines[start_l - 1 : end_l]).strip()

    def visit_Return(self, node):
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)

        # Collect return variables for downstream reachability
        for inner in ast.walk(node):
            if isinstance(inner, ast.Name):
                self.return_vars.add(inner.id)

        lum = 0.90
        self.statements.append({
            "line": start_l,
            "end_line": end_l,
            "code": code,
            "luminance": lum,
            "classification": "bright",
            "type": "return_sink",
            "reason": "Primary program output return sink",
            "factors": {
                "data_flow": 1.0,
                "control_flow": 0.9,
                "mutation": 0.8,
                "side_effect": 0.0,
                "identity_penalty": 0.0
            }
        })
        self.generic_visit(node)

    def visit_Raise(self, node):
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)
        lum = 0.98
        self.statements.append({
            "line": start_l,
            "end_line": end_l,
            "code": code,
            "luminance": lum,
            "classification": "bright",
            "type": "exception_control",
            "reason": "Critical control-flow termination / safety invariant gate",
            "factors": {
                "data_flow": 0.9,
                "control_flow": 1.0,
                "mutation": 0.5,
                "side_effect": 1.0,
                "identity_penalty": 0.0
            }
        })
        self.generic_visit(node)

    def visit_If(self, node):
        start_l = getattr(node, "lineno", 1)
        test_code = self._get_code(start_l, start_l)
        has_raise = any(isinstance(child, ast.Raise) for child in ast.walk(node))
        lum = 0.96 if has_raise else 0.88
        self.statements.append({
            "line": start_l,
            "end_line": start_l,
            "code": test_code,
            "luminance": lum,
            "classification": "bright",
            "type": "conditional_branch",
            "reason": "Control-flow branch bifurcation" + (" with invariant guard" if has_raise else ""),
            "factors": {
                "data_flow": 0.8,
                "control_flow": 0.95 if has_raise else 0.85,
                "mutation": 0.0,
                "side_effect": 0.0,
                "identity_penalty": 0.0
            }
        })
        self.generic_visit(node)

    def visit_For(self, node):
        start_l = getattr(node, "lineno", 1)
        code = self._get_code(start_l, start_l)
        lum = 0.88
        self.statements.append({
            "line": start_l,
            "end_line": start_l,
            "code": code,
            "luminance": lum,
            "classification": "bright",
            "type": "loop_iteration",
            "reason": "Collection iteration and traversal control",
            "factors": {
                "data_flow": 0.85,
                "control_flow": 0.90,
                "mutation": 0.70,
                "side_effect": 0.0,
                "identity_penalty": 0.0
            }
        })
        self.generic_visit(node)

    def visit_Assign(self, node):
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)

        is_identity, reason = is_identity_operation(node)
        if is_identity:
            lum = 0.00
            self.statements.append({
                "line": start_l,
                "end_line": end_l,
                "code": code,
                "luminance": lum,
                "classification": "dark",
                "type": "vacuous_identity",
                "reason": reason,
                "factors": {
                    "data_flow": 0.0,
                    "control_flow": 0.0,
                    "mutation": 0.0,
                    "side_effect": 0.0,
                    "identity_penalty": 1.0
                }
            })
        else:
            # Significant transformation or function call
            has_call = isinstance(node.value, ast.Call)
            has_binop = isinstance(node.value, ast.BinOp)
            
            if has_call:
                lum = 0.92
                reason_str = "Aggregator or functional transformation assignment"
            elif has_binop:
                lum = 0.85
                reason_str = "State mutation with arithmetic transformation"
            else:
                lum = 0.78
                reason_str = "Variable definition and initialization"

            self.statements.append({
                "line": start_l,
                "end_line": end_l,
                "code": code,
                "luminance": lum,
                "classification": "bright" if lum >= 0.70 else "medium",
                "type": "state_mutation",
                "reason": reason_str,
                "factors": {
                    "data_flow": 0.90,
                    "control_flow": 0.40,
                    "mutation": 0.85,
                    "side_effect": 0.10 if has_call else 0.0,
                    "identity_penalty": 0.0
                }
            })
        self.generic_visit(node)

    def visit_AugAssign(self, node):
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)

        is_identity, reason = is_identity_operation(node)
        if is_identity:
            lum = 0.00
            self.statements.append({
                "line": start_l,
                "end_line": end_l,
                "code": code,
                "luminance": lum,
                "classification": "dark",
                "type": "vacuous_identity",
                "reason": reason,
                "factors": {
                    "data_flow": 0.0,
                    "control_flow": 0.0,
                    "mutation": 0.0,
                    "side_effect": 0.0,
                    "identity_penalty": 1.0
                }
            })
        else:
            lum = 0.91
            self.statements.append({
                "line": start_l,
                "end_line": end_l,
                "code": code,
                "luminance": lum,
                "classification": "bright",
                "type": "accumulator_mutation",
                "reason": "In-place state accumulation and reduction mutation",
                "factors": {
                    "data_flow": 0.95,
                    "control_flow": 0.30,
                    "mutation": 0.92,
                    "side_effect": 0.0,
                    "identity_penalty": 0.0
                }
            })
        self.generic_visit(node)

    def visit_Expr(self, node):
        # Top level expression like print() or func call
        start_l = getattr(node, "lineno", 1)
        end_l = getattr(node, "end_lineno", start_l)
        code = self._get_code(start_l, end_l)

        if isinstance(node.value, ast.Call):
            # Print / log or external call
            lum = 0.76
            self.statements.append({
                "line": start_l,
                "end_line": end_l,
                "code": code,
                "luminance": lum,
                "classification": "bright",
                "type": "side_effect_call",
                "reason": "I/O or observable system side-effect invocation",
                "factors": {
                    "data_flow": 0.30,
                    "control_flow": 0.20,
                    "mutation": 0.20,
                    "side_effect": 0.90,
                    "identity_penalty": 0.0
                }
            })
        self.generic_visit(node)


def calculate_causal_entropy(scores: list[float]) -> float:
    """Calculates normalized Shannon entropy of the luminance score distribution."""
    if not scores:
        return 0.0
    bins = [0] * 5
    for s in scores:
        idx = min(4, int(s * 5))
        bins[idx] += 1
    n = len(scores)
    entropy = 0.0
    for count in bins:
        if count > 0:
            p = count / n
            entropy -= p * math.log2(p)
    max_entropy = math.log2(5)
    return round(entropy / max_entropy, 2)


def calculate_workspace_luminance(workspace_root: str) -> dict:
    abs_root = os.path.abspath(workspace_root)
    if not os.path.exists(abs_root):
        return {
            "workspace": workspace_root,
            "mean_luminance": 0.0,
            "median_luminance": 0.0,
            "dark_code_ratio": 0.0,
            "bright_code_ratio": 0.0,
            "causal_entropy_index": 0.0,
            "total_files": 0,
            "total_statements": 0,
            "histogram": [],
            "darkest_statements": [],
            "files": [],
            "error": f"Workspace directory not found: {workspace_root}",
        }

    all_file_reports = []
    all_scores = []
    all_dark_statements = []

    for root, dirs, files in os.walk(abs_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in sorted(files):
            if not file.endswith(".py") or file.endswith(".echo-nullity-backup"):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.read().splitlines()
                source = "\n".join(lines)
                tree = ast.parse(source, filename=file_path)
                visitor = LuminanceVisitor(lines, file_path, abs_root)
                visitor.visit(tree)

                # Deduplicate statements by line
                unique_stmts = {}
                for s in visitor.statements:
                    if s["line"] not in unique_stmts or s["luminance"] < unique_stmts[s["line"]]["luminance"]:
                        unique_stmts[s["line"]] = s
                
                stmts_list = sorted(unique_stmts.values(), key=lambda s: s["line"])
                file_scores = [s["luminance"] for s in stmts_list]
                all_scores.extend(file_scores)

                file_mean = round(sum(file_scores) / max(1, len(file_scores)), 2) if file_scores else 0.0

                for s in stmts_list:
                    if s["luminance"] <= 0.20:
                        all_dark_statements.append({
                            "file": visitor.rel_path,
                            "line": s["line"],
                            "code": s["code"],
                            "luminance": s["luminance"],
                            "reason": s.get("reason", "Vacuous / Non-causal operation"),
                        })

                all_file_reports.append({
                    "file": visitor.rel_path,
                    "absolute_path": file_path,
                    "statements_count": len(stmts_list),
                    "mean_luminance": file_mean,
                    "statements": stmts_list,
                })
            except Exception:
                continue

    total_statements = len(all_scores)
    mean_lum = round(sum(all_scores) / max(1, total_statements), 2) if all_scores else 0.0
    
    sorted_scores = sorted(all_scores)
    median_lum = round(sorted_scores[len(sorted_scores) // 2], 2) if sorted_scores else 0.0

    dark_count = sum(1 for s in all_scores if s < 0.25)
    bright_count = sum(1 for s in all_scores if s >= 0.70)
    dim_count = sum(1 for s in all_scores if 0.25 <= s < 0.50)
    mod_count = sum(1 for s in all_scores if 0.50 <= s < 0.70)

    dark_ratio = round(dark_count / max(1, total_statements), 3)
    bright_ratio = round(bright_count / max(1, total_statements), 3)
    entropy = calculate_causal_entropy(all_scores)

    histogram = [
        {
            "range": "0.0 - 0.2 (Dark / Vacuous)",
            "count": dark_count,
            "percentage": round((dark_count / max(1, total_statements)) * 100, 1),
            "color": "#ef4444",
        },
        {
            "range": "0.2 - 0.5 (Dim)",
            "count": dim_count,
            "percentage": round((dim_count / max(1, total_statements)) * 100, 1),
            "color": "#f97316",
        },
        {
            "range": "0.5 - 0.8 (Moderate)",
            "count": mod_count,
            "percentage": round((mod_count / max(1, total_statements)) * 100, 1),
            "color": "#a855f7",
        },
        {
            "range": "0.8 - 1.0 (Bright / High Causal)",
            "count": bright_count,
            "percentage": round((bright_count / max(1, total_statements)) * 100, 1),
            "color": "#06b6d4",
        },
    ]

    return {
        "workspace": workspace_root,
        "total_files": len(all_file_reports),
        "total_statements": total_statements,
        "mean_luminance": mean_lum,
        "median_luminance": median_lum,
        "dark_code_ratio": dark_ratio,
        "bright_code_ratio": bright_ratio,
        "causal_entropy_index": entropy,
        "histogram": histogram,
        "darkest_statements": all_dark_statements,
        "files": all_file_reports,
    }


def main():
    workspace = sys.argv[1] if len(sys.argv) > 1 else "."
    res = calculate_workspace_luminance(workspace)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
