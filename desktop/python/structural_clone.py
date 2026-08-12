#!/usr/bin/env python3
"""
Structural Clone Normalizer & Candidate Extractor for Python AST.
Normalizes identifiers (variables, attributes, constants, function names)
into canonical representations while preserving syntactic and operational structures.
"""

import ast
import sys


def normalize_node(node: ast.AST) -> str:
    """
    Recursively transforms an AST node into a deterministic canonical string.
    Normalizes identifiers:
      - Variable names (ast.Name in load/store) -> VAR
      - Function calls (ast.Call func name) -> FUNC
      - Attribute names (ast.Attribute attr) -> ATTR
      - Constant literals (ast.Constant) -> CONST
      - Operators and control-flow structure are strictly preserved.
    """
    if node is None:
        return ""

    if isinstance(node, ast.Name):
        return "VAR"

    if isinstance(node, ast.Constant):
        return "CONST"

    if isinstance(node, ast.Attribute):
        return f"Attribute({normalize_node(node.value)},ATTR)"

    if isinstance(node, ast.BinOp):
        op_name = node.op.__class__.__name__
        left = normalize_node(node.left)
        right = normalize_node(node.right)
        return f"BinOp({left},{op_name},{right})"

    if isinstance(node, ast.UnaryOp):
        op_name = node.op.__class__.__name__
        operand = normalize_node(node.operand)
        return f"UnaryOp({op_name},{operand})"

    if isinstance(node, ast.BoolOp):
        op_name = node.op.__class__.__name__
        values = ",".join(normalize_node(v) for v in node.values)
        return f"BoolOp({op_name},[{values}])"

    if isinstance(node, ast.Compare):
        left = normalize_node(node.left)
        ops = ",".join(op.__class__.__name__ for op in node.ops)
        comparators = ",".join(normalize_node(c) for c in node.comparators)
        return f"Compare({left},[{ops}],[{comparators}])"

    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name):
            func_repr = "FUNC"
        elif isinstance(node.func, ast.Attribute):
            func_repr = f"Attribute({normalize_node(node.func.value)},ATTR)"
        else:
            func_repr = normalize_node(node.func)

        args = ",".join(normalize_node(a) for a in node.args)
        return f"Call({func_repr},[{args}])"

    if isinstance(node, ast.Subscript):
        val = normalize_node(node.value)
        slice_repr = normalize_node(node.slice)
        return f"Subscript({val},{slice_repr})"

    if isinstance(node, ast.List):
        elts = ",".join(normalize_node(e) for e in node.elts)
        return f"List([{elts}])"

    if isinstance(node, ast.Tuple):
        elts = ",".join(normalize_node(e) for e in node.elts)
        return f"Tuple([{elts}])"

    if isinstance(node, ast.Dict):
        keys = ",".join(normalize_node(k) if k else "None" for k in node.keys)
        values = ",".join(normalize_node(v) for v in node.values)
        return f"Dict([{keys}],[{values}])"

    if isinstance(node, ast.Assign):
        targets = ",".join(normalize_node(t) for t in node.targets)
        val = normalize_node(node.value)
        return f"Assign({targets},{val})"

    if isinstance(node, ast.AugAssign):
        target = normalize_node(node.target)
        op_name = node.op.__class__.__name__
        val = normalize_node(node.value)
        return f"AugAssign({target},{op_name},{val})"

    if isinstance(node, ast.Return):
        val = normalize_node(node.value) if node.value else "None"
        return f"Return({val})"

    if isinstance(node, ast.If):
        test = normalize_node(node.test)
        return f"If({test})"

    if isinstance(node, ast.For):
        target = normalize_node(node.target)
        iter_node = normalize_node(node.iter)
        return f"For({target},{iter_node})"

    if isinstance(node, ast.While):
        test = normalize_node(node.test)
        return f"While({test})"

    if isinstance(node, ast.Expr):
        return normalize_node(node.value)

    # Fallback to class name with child components
    node_name = node.__class__.__name__
    return f"{node_name}()"


def is_docstring(node: ast.AST) -> bool:
    """Checks if an AST node is a string constant expression (docstring)."""
    return (
        isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    )


def extract_clone_candidates(source: str) -> list[dict]:
    """
    Parses Python source code, walks top-level and function statements,
    filters out trivial statements, and extracts structural clone candidates.
    """
    candidates = []
    if not source.strip():
        return candidates

    try:
        tree = ast.parse(source)
    except Exception:
        return candidates

    source_lines = source.splitlines()

    def get_source_segment(start_line: int, end_line: int) -> str:
        if start_line < 1 or end_line > len(source_lines):
            return ""
        return "\n".join(source_lines[start_line - 1 : end_line]).strip()

    for node in ast.walk(tree):
        # Ignore module or function definitions container themselves, look at statements
        if not hasattr(node, "lineno"):
            continue

        # Ignore trivial statements: pass, break, continue, imports, docstrings
        if isinstance(node, (ast.Pass, ast.Break, ast.Continue, ast.Import, ast.ImportFrom)):
            continue

        if is_docstring(node):
            continue

        # Target substantial structural statements: Assign, AugAssign, Return, Expr (Calls), If, For, While
        if isinstance(node, (ast.Assign, ast.AugAssign, ast.Return, ast.If, ast.For, ast.While)) or (
            isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
        ):
            kind = node.__class__.__name__
            start_line = getattr(node, "lineno", 1)
            end_line = getattr(node, "end_lineno", start_line)

            # Avoid single-token trivial constants or empty expressions
            fingerprint = normalize_node(node)
            if not fingerprint or fingerprint in {"CONST", "VAR", "Pass()", "None"}:
                continue

            code_snippet = get_source_segment(start_line, end_line)
            if not code_snippet:
                continue

            candidates.append({
                "kind": kind,
                "start_line": start_line,
                "end_line": end_line,
                "fingerprint": fingerprint,
                "code": code_snippet,
            })

    return candidates
