#!/usr/bin/env python3
import sys
import os
import json
import ast
import hashlib
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

class ASTNormalizer(ast.NodeTransformer):
    """
    Transforms AST nodes into a normalized form:
    - Renames local variables to VAR_1, VAR_2... in order of first appearance
    - Normalizes numeric constants to 0 and string constants to 'STR'
    - Retains control-flow and operator structure
    """
    def __init__(self):
        super().__init__()
        self.var_map = {}
        self.var_counter = 0

    def get_var_name(self, name: str) -> str:
        # Preserve builtins
        builtins = {"range", "len", "sum", "max", "min", "round", "enumerate", "zip", "map", "filter", "print", "str", "int", "float", "list", "dict", "set", "None", "True", "False"}
        if name in builtins:
            return name
        if name not in self.var_map:
            self.var_counter += 1
            self.var_map[name] = f"VAR_{self.var_counter}"
        return self.var_map[name]

    def visit_Name(self, node: ast.Name):
        new_name = self.get_var_name(node.id)
        return ast.copy_location(ast.Name(id=new_name, ctx=node.ctx), node)

    def visit_arg(self, node: ast.arg):
        new_arg = self.get_var_name(node.arg)
        return ast.copy_location(ast.arg(arg=new_arg, annotation=node.annotation), node)

    def visit_Constant(self, node: ast.Constant):
        if isinstance(node.value, (int, float)):
            return ast.copy_location(ast.Constant(value=0), node)
        elif isinstance(node.value, str):
            return ast.copy_location(ast.Constant(value="STR"), node)
        elif isinstance(node.value, bool):
            return ast.copy_location(ast.Constant(value=True), node)
        return node


def is_ignored_dir(d: str) -> bool:
    return d in IGNORED_DIRS or d.startswith(".") or d.startswith("EchoNullity-Report-")


def normalize_subtree(node: ast.AST) -> str:
    """Creates a normalized AST string representation."""
    normalizer = ASTNormalizer()
    normalized_tree = normalizer.visit(ast.fix_missing_locations(node))
    return ast.dump(normalized_tree, include_attributes=False)


def extract_clones_from_file(file_path: str, workspace_root: str, source_lines: list, min_statements: int = 1) -> list:
    rel_path = os.path.relpath(file_path, workspace_root)
    source = "\n".join(source_lines)
    clones = []

    try:
        tree = ast.parse(source, filename=file_path)
    except Exception:
        return []

    # 1. Function-level clones
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if len(node.body) >= min_statements:
                start_l = node.lineno
                end_l = getattr(node, "end_lineno", start_l + len(node.body))
                code_snippet = "\n".join(source_lines[start_l - 1 : end_l]).strip()
                sig = normalize_subtree(node)
                clones.append({
                    "type": "function",
                    "name": node.name,
                    "file": rel_path,
                    "absolute_path": file_path,
                    "start_line": start_l,
                    "end_line": end_l,
                    "code": code_snippet,
                    "signature": sig,
                    "hash": hashlib.sha256(sig.encode()).hexdigest()[:16],
                })

        # 2. Block/Statement level clones (loops, conditionals, assignments)
        elif isinstance(node, (ast.For, ast.While, ast.If, ast.Assign)):
            start_l = getattr(node, "lineno", 1)
            end_l = getattr(node, "end_lineno", start_l)
            if end_l >= start_l:
                code_snippet = "\n".join(source_lines[start_l - 1 : end_l]).strip()
                if len(code_snippet) > 15: # Ignore trivial 1-liners like x = 1
                    sig = normalize_subtree(node)
                    clones.append({
                        "type": "statement_block",
                        "name": f"L{start_l}-{end_l}",
                        "file": rel_path,
                        "absolute_path": file_path,
                        "start_line": start_l,
                        "end_line": end_l,
                        "code": code_snippet,
                        "signature": sig,
                        "hash": hashlib.sha256(sig.encode()).hexdigest()[:16],
                    })

    return clones


def detect_clones_in_workspace(workspace_root: str, min_group_size: int = 2) -> dict:
    abs_root = os.path.abspath(workspace_root)
    if not os.path.exists(abs_root):
        return {
            "workspace": workspace_root,
            "total_files": 0,
            "total_clone_groups": 0,
            "total_clones": 0,
            "groups": [],
            "error": f"Workspace does not exist: {workspace_root}",
        }

    all_clones = []
    py_files_count = 0

    for root, dirs, files in os.walk(abs_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for file in files:
            if not file.endswith(".py") or file.endswith(".echo-nullity-backup"):
                continue

            py_files_count += 1
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.read().splitlines()
                file_clones = extract_clones_from_file(file_path, abs_root, lines)
                all_clones.extend(file_clones)
            except Exception:
                continue

    # Group by structural signature hash
    groups_by_sig = defaultdict(list)
    for c in all_clones:
        groups_by_sig[c["hash"]].append(c)

    # Filter for clone groups with instances >= min_group_size
    valid_groups = []
    group_idx = 1

    for sig_hash, instances in groups_by_sig.items():
        # Remove duplicates located on exact same file & line range
        unique_instances = []
        seen_locs = set()
        for inst in instances:
            loc = (inst["file"], inst["start_line"], inst["end_line"])
            if loc not in seen_locs:
                seen_locs.add(loc)
                unique_instances.append(inst)

        if len(unique_instances) >= min_group_size:
            # Check if instances span across different files or distinct blocks
            files_involved = list({inst["file"] for inst in unique_instances})
            valid_groups.append({
                "group_id": f"clone-group-{group_idx}",
                "similarity": 1.0,
                "similarity_label": "100% Structural AST Match",
                "clone_type": unique_instances[0]["type"],
                "signature": unique_instances[0]["signature"],
                "signature_hash": sig_hash,
                "files_count": len(files_involved),
                "files": files_involved,
                "instances_count": len(unique_instances),
                "instances": unique_instances,
            })
            group_idx += 1

    # Sort groups by instances count descending
    valid_groups.sort(key=lambda g: (len(g["files"]), g["instances_count"]), reverse=True)

    total_clones = sum(g["instances_count"] for g in valid_groups)

    return {
        "workspace": workspace_root,
        "total_files": py_files_count,
        "total_clone_groups": len(valid_groups),
        "total_clones": total_clones,
        "groups": valid_groups,
    }


def main():
    workspace = sys.argv[1] if len(sys.argv) > 1 else "."
    result = detect_clones_in_workspace(workspace)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
