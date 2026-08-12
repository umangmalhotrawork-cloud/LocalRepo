#!/usr/bin/env python3
import sys
import json
import ast
import argparse

CONTAINER_TYPES = (
    ast.If,
    ast.For,
    ast.While,
    ast.With,
    ast.Try,
    ast.FunctionDef,
    ast.AsyncFunctionDef,
    ast.ClassDef,
)

def is_number(node, target_val):
    if isinstance(node, ast.Constant):
        if type(node.value) in (int, float) and not isinstance(node.value, bool):
            return node.value == target_val
    return False

def is_one(node):
    return is_number(node, 1) or is_number(node, 1.0)

def is_zero(node):
    return is_number(node, 0) or is_number(node, 0.0)

def match_identity_binop(node):
    if not isinstance(node, ast.BinOp):
        return None
    if isinstance(node.op, ast.Mult):
        if is_one(node.right):
            return (node.left, "multiplication by 1", "Identity Multiplication (x * 1)", "Multiplying by 1 leaves output state identical.")
        if is_one(node.left):
            return (node.right, "multiplication by 1", "Identity Multiplication (1 * x)", "Multiplying by 1 leaves output state identical.")
    elif isinstance(node.op, ast.Add):
        if is_zero(node.right):
            return (node.left, "addition by 0", "Identity Addition (x + 0)", "Adding 0 leaves value invariant.")
        if is_zero(node.left):
            return (node.right, "addition by 0", "Identity Addition (0 + x)", "Adding 0 leaves value invariant.")
    elif isinstance(node.op, ast.Sub):
        if is_zero(node.right):
            return (node.left, "subtraction by 0", "Identity Subtraction (x - 0)", "Subtracting 0 exerts zero state leverage.")
    elif isinstance(node.op, ast.Div):
        if is_one(node.right):
            return (node.left, "division by 1", "Identity Division (x / 1)", "Dividing by 1 is mathematically redundant.")
    return None

def get_stmt_defs_and_uses(stmt):
    defs = set()
    uses = set()
    for n in ast.walk(stmt):
        if isinstance(n, (ast.Assign, ast.AnnAssign)):
            targets = n.targets if isinstance(n, ast.Assign) else [n.target]
            for t in targets:
                for tn in ast.walk(t):
                    if isinstance(tn, ast.Name):
                        defs.add(tn.id)
        elif isinstance(n, ast.AugAssign):
            if isinstance(n.target, ast.Name):
                defs.add(n.target.id)
        elif isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
            uses.add(n.id)
    return defs, uses

def build_provenance_chain(target_name, ghost_line, tree, lines, ghost_lines_set=None):
    if ghost_lines_set is None:
        ghost_lines_set = set()

    chain = []

    # Collect leaf statements in chronological order
    stmts = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.stmt) and not isinstance(node, CONTAINER_TYPES)
    ]
    stmts.sort(key=lambda s: s.lineno)

    # 1. Definition: Find statement before ghost_line defining target_name
    def_stmt = None
    for s in reversed(stmts):
        if s.lineno < ghost_line:
            defs, _ = get_stmt_defs_and_uses(s)
            if target_name in defs and s.lineno not in ghost_lines_set:
                def_stmt = s
                break

    if def_stmt is not None:
        chain.append({
            "type": "definition",
            "line": def_stmt.lineno,
            "code": lines[def_stmt.lineno - 1].strip() if def_stmt.lineno <= len(lines) else ""
        })
    else:
        # Check function parameters
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                arg_names = [a.arg for a in node.args.args]
                if target_name in arg_names:
                    chain.append({
                        "type": "definition",
                        "line": node.lineno,
                        "code": lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                    })
                    break

    # 2. Ghost Operation
    chain.append({
        "type": "ghost_operation",
        "line": ghost_line,
        "code": lines[ghost_line - 1].strip() if ghost_line <= len(lines) else ""
    })

    # 3. Downstream Uses & Return Sink
    active_vars = {target_name} if target_name else set()
    seen_use_lines = set()
    return_sink = None

    for s in stmts:
        if s.lineno > ghost_line:
            defs, uses = get_stmt_defs_and_uses(s)
            if isinstance(s, ast.Return):
                if not active_vars or (uses & active_vars) or return_sink is None:
                    return_sink = {
                        "type": "return_sink",
                        "line": s.lineno,
                        "code": lines[s.lineno - 1].strip() if s.lineno <= len(lines) else ""
                    }
                break

            if uses & active_vars and s.lineno not in seen_use_lines and s.lineno not in ghost_lines_set:
                seen_use_lines.add(s.lineno)
                chain.append({
                    "type": "use",
                    "line": s.lineno,
                    "code": lines[s.lineno - 1].strip() if s.lineno <= len(lines) else ""
                })
                if defs:
                    active_vars.update(defs)

    if return_sink is not None:
        chain.append(return_sink)

    return chain

class IdentityVisitor(ast.NodeVisitor):
    def __init__(self, source_lines, tree=None):
        self.source_lines = source_lines
        self.tree = tree
        self.raw_findings = []
        self.current_assignment_target = None

    def visit_Assign(self, node):
        prev = self.current_assignment_target
        try:
            self.current_assignment_target = ", ".join(ast.unparse(t) for t in node.targets)
        except Exception:
            self.current_assignment_target = None
        self.generic_visit(node)
        self.current_assignment_target = prev

    def visit_AugAssign(self, node):
        prev = self.current_assignment_target
        try:
            self.current_assignment_target = ast.unparse(node.target)
        except Exception:
            self.current_assignment_target = None
        self.generic_visit(node)
        self.current_assignment_target = prev

    def visit_AnnAssign(self, node):
        prev = self.current_assignment_target
        try:
            self.current_assignment_target = ast.unparse(node.target)
        except Exception:
            self.current_assignment_target = None
        self.generic_visit(node)
        self.current_assignment_target = prev

    def visit_BinOp(self, node):
        match = match_identity_binop(node)
        if match:
            simplified_operand, op_desc, title, reason = match
            line_idx = getattr(node, "lineno", 1)
            code_line = (
                self.source_lines[line_idx - 1].strip()
                if line_idx <= len(self.source_lines)
                else ast.unparse(node)
            )

            provenance = []
            if self.current_assignment_target:
                provenance.append(f"Assignment target: {self.current_assignment_target}")
            provenance.append(f"Identity operation: {op_desc}")
            provenance.append("Expression is semantically equivalent to original value")

            self.raw_findings.append({
                "line": line_idx,
                "code": code_line,
                "title": title,
                "reason": reason,
                "luminance": 0.00,
                "status": "Verified Ghost Line",
                "category": "vacuous_identity",
                "provenance": provenance,
                "target_name": self.current_assignment_target
            })
        self.generic_visit(node)

    def finalize_findings(self):
        ghost_lines_set = {f["line"] for f in self.raw_findings}
        findings = []
        for rf in self.raw_findings:
            chain = []
            if self.tree is not None:
                chain = build_provenance_chain(
                    rf["target_name"], rf["line"], self.tree, self.source_lines, ghost_lines_set
                )
            
            return_sink_line = None
            for step in chain:
                if step.get("type") == "return_sink":
                    return_sink_line = step.get("line")
                    break

            findings.append({
                "line": rf["line"],
                "code": rf["code"],
                "title": rf["title"],
                "reason": rf["reason"],
                "luminance": rf["luminance"],
                "status": rf["status"],
                "category": rf["category"],
                "provenance": rf["provenance"],
                "provenance_chain": chain,
                "causal_path_length": len(chain),
                "return_sink_line": return_sink_line
            })
        return findings

class IdentityTransformer(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        match = match_identity_binop(node)
        if match:
            simplified_operand, _, _, _ = match
            return simplified_operand
        return node

def analyze_source(content, file_path="<string>"):
    lines = content.splitlines()
    try:
        tree = ast.parse(content, filename=file_path)
    except SyntaxError as e:
        return {
            "file": file_path,
            "error": f"SyntaxError at line {e.lineno}: {e.msg}",
            "total_lines": len(lines),
            "ghost_lines_count": 0,
            "causal_luminance": 1.00,
            "findings": []
        }
    except Exception as e:
        return {
            "file": file_path,
            "error": str(e),
            "total_lines": len(lines),
            "ghost_lines_count": 0,
            "causal_luminance": 1.00,
            "findings": []
        }

    visitor = IdentityVisitor(lines, tree=tree)
    visitor.visit(tree)
    findings = visitor.finalize_findings()

    return {
        "file": file_path,
        "total_lines": len(lines),
        "ghost_lines_count": len(findings),
        "causal_luminance": 0.00 if findings else 1.00,
        "findings": findings
    }

def analyze_code(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return {
            "file": file_path,
            "error": str(e),
            "total_lines": 0,
            "ghost_lines_count": 0,
            "causal_luminance": 1.00,
            "findings": []
        }

    return analyze_source(content, file_path)

def rewrite_code(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return {
            "file": file_path,
            "error": str(e),
            "original_source": "",
            "transformed_source": "",
            "changed_lines": [],
            "ghost_count_before": 0,
            "ghost_count_after": 0,
            "causal_luminance_after": 1.00
        }

    analysis_before = analyze_source(content, file_path)
    if "error" in analysis_before and not analysis_before["findings"]:
        return {
            "file": file_path,
            "error": analysis_before["error"],
            "original_source": content,
            "transformed_source": "",
            "changed_lines": [],
            "ghost_count_before": 0,
            "ghost_count_after": 0,
            "causal_luminance_after": 1.00
        }

    try:
        tree = ast.parse(content, filename=file_path)
        transformer = IdentityTransformer()
        transformed_tree = transformer.visit(tree)
        ast.fix_missing_locations(transformed_tree)
        transformed_source = ast.unparse(transformed_tree)
    except Exception as e:
        return {
            "file": file_path,
            "error": f"AST transformation failed: {str(e)}",
            "original_source": content,
            "transformed_source": "",
            "changed_lines": [],
            "ghost_count_before": analysis_before.get("ghost_lines_count", 0),
            "ghost_count_after": 0,
            "causal_luminance_after": 1.00
        }

    changed_lines = [f["line"] for f in analysis_before.get("findings", [])]
    analysis_after = analyze_source(transformed_source, file_path)

    return {
        "file": file_path,
        "original_source": content,
        "transformed_source": transformed_source,
        "changed_lines": changed_lines,
        "ghost_count_before": analysis_before.get("ghost_lines_count", 0),
        "ghost_count_after": analysis_after.get("ghost_lines_count", 0),
        "causal_luminance_after": analysis_after.get("causal_luminance", 1.00)
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Python AST Analyzer & Rewrite Engine")
    parser.add_argument("file", help="Path to Python file")
    parser.add_argument("--mode", choices=["analyze", "rewrite"], default="analyze", help="Execution mode")

    args = parser.parse_args()

    if args.mode == "rewrite":
        result = rewrite_code(args.file)
    else:
        result = analyze_code(args.file)

    print(json.dumps(result, indent=2))
