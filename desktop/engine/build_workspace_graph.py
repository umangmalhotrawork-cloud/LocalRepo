#!/usr/bin/env python3
import sys
import os
import json
import ast
import argparse

# Ensure engine directory is in path to import analyze
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from analyze import analyze_source
from detect_clones import detect_clones_in_workspace
from detect_semantic_clones import detect_semantic_clones_in_workspace

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

def is_identity_operation(node):
    if not isinstance(node, ast.BinOp):
        return False
    op = node.op
    left = node.left
    right = node.right

    def is_num(n, val):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value == val
        return False

    if isinstance(op, ast.Mult) and (is_num(right, 1) or is_num(left, 1)):
        return True
    if isinstance(op, ast.Add) and (is_num(right, 0) or is_num(left, 0)):
        return True
    if isinstance(op, ast.Sub) and is_num(right, 0):
        return True
    if isinstance(op, ast.Div) and is_num(right, 1):
        return True
    return False

def extract_file_graph(filepath, rel_path, source_lines):
    source = "\n".join(source_lines)
    nodes = []
    edges = []

    try:
        tree = ast.parse(source, filename=rel_path)
    except Exception as e:
        return nodes, edges

    # Track variable symbols defined and used per scope
    # First, run intra-file analysis via analyze_source to get high-fidelity provenance chains
    analysis = analyze_source(source, file_path=rel_path)
    findings = analysis.get("findings", [])

    created_node_ids = set()

    for f_idx, finding in enumerate(findings):
        chain = finding.get("provenance_chain", [])
        prev_node_id = None

        for step_idx, step in enumerate(chain):
            step_type = step.get("type", "use")
            line = step.get("line", 1)
            code = step.get("code", "")
            
            # Extract symbol name if possible
            symbol = "val"
            if "=" in code:
                symbol = code.split("=")[0].strip().split()[0]
            elif "def " in code:
                symbol = code.split("(")[0].replace("def ", "").strip()
            elif "return " in code:
                symbol = code.replace("return ", "").strip()

            node_id = f"{rel_path}::L{line}::{symbol}::{step_type}"

            if node_id not in created_node_ids:
                created_node_ids.add(node_id)
                nodes.append({
                    "id": node_id,
                    "file": rel_path,
                    "symbol": symbol,
                    "line": line,
                    "kind": step_type,
                    "code": code,
                    "label": f"{symbol} (L{line})" if symbol else f"L{line}"
                })

            if prev_node_id and prev_node_id != node_id:
                edge_type = "ghost_flow" if step_type == "ghost_operation" else "data_flow"
                edges.append({
                    "source": prev_node_id,
                    "target": node_id,
                    "type": edge_type
                })

            prev_node_id = node_id

    # If file has non-ghost functions/classes, add top-level symbols
    for item in tree.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_id = f"{rel_path}::{item.name}"
            if func_id not in created_node_ids:
                created_node_ids.add(func_id)
                code_line = source_lines[item.lineno - 1] if item.lineno <= len(source_lines) else f"def {item.name}"
                nodes.append({
                    "id": func_id,
                    "file": rel_path,
                    "symbol": item.name,
                    "line": item.lineno,
                    "kind": "definition",
                    "code": code_line.strip(),
                    "label": f"def {item.name}()"
                })

                # Check returns in this function
                for sub in ast.walk(item):
                    if isinstance(sub, ast.Return) and sub.lineno:
                        ret_id = f"{rel_path}::L{sub.lineno}::return"
                        if ret_id not in created_node_ids:
                            created_node_ids.add(ret_id)
                            ret_code = source_lines[sub.lineno - 1] if sub.lineno <= len(source_lines) else "return"
                            nodes.append({
                                "id": ret_id,
                                "file": rel_path,
                                "symbol": "return",
                                "line": sub.lineno,
                                "kind": "return_sink",
                                "code": ret_code.strip(),
                                "label": f"return (L{sub.lineno})"
                            })
                            edges.append({
                                "source": func_id,
                                "target": ret_id,
                                "type": "data_flow"
                            })

    return nodes, edges

def build_workspace_graph(workspace_path):
    abs_workspace = os.path.abspath(workspace_path)
    if not os.path.exists(abs_workspace):
        return {
            "workspace": workspace_path,
            "nodes": [],
            "edges": [],
            "error": f"Directory not found: {workspace_path}"
        }

    py_files = []
    for root, dirs, files in os.walk(abs_workspace):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        for f in sorted(files):
            if f.endswith(".py"):
                py_files.append(os.path.join(root, f))

    all_nodes = []
    all_edges = []
    file_map = {}

    for fpath in py_files:
        rel_path = os.path.relpath(fpath, abs_workspace)
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
                source_lines = fh.read().splitlines()
        except Exception:
            continue

        file_map[rel_path] = source_lines
        file_nodes, file_edges = extract_file_graph(fpath, rel_path, source_lines)
        all_nodes.extend(file_nodes)
        all_edges.extend(file_edges)

    # Detect Cross-File Imports
    # e.g., from src.cart_calculator import calculate_cart_total
    for rel_path, source_lines in file_map.items():
        source = "\n".join(source_lines)
        try:
            tree = ast.parse(source, filename=rel_path)
        except Exception:
            continue

        for stmt in tree.body:
            if isinstance(stmt, ast.ImportFrom):
                module = stmt.module or ""
                for alias in stmt.names:
                    imported_name = alias.name
                    # Find if imported_name matches a definition in another file
                    for target_node in all_nodes:
                        if target_node["kind"] == "definition" and target_node["symbol"] == imported_name:
                            if target_node["file"] != rel_path:
                                import_node_id = f"{rel_path}::import::{imported_name}"
                                if not any(n["id"] == import_node_id for n in all_nodes):
                                    all_nodes.append({
                                        "id": import_node_id,
                                        "file": rel_path,
                                        "symbol": imported_name,
                                        "line": stmt.lineno,
                                        "kind": "use",
                                        "code": source_lines[stmt.lineno - 1].strip() if stmt.lineno <= len(source_lines) else f"import {imported_name}",
                                        "label": f"import {imported_name}"
                                    })
                                all_edges.append({
                                    "source": target_node["id"],
                                    "target": import_node_id,
                                    "type": "cross_file_import"
                                })

    # Detect Structural Clones and add dashed clone edges
    try:
        clones_result = detect_clones_in_workspace(abs_workspace)
        for group in clones_result.get("groups", []):
            instances = group.get("instances", [])
            for i in range(len(instances)):
                for j in range(i + 1, len(instances)):
                    inst_a = instances[i]
                    inst_b = instances[j]
                    
                    node_a_id = None
                    node_b_id = None
                    for n in all_nodes:
                        if n["file"] == inst_a["file"] and n.get("line") == inst_a["start_line"]:
                            node_a_id = n["id"]
                            break
                    for n in all_nodes:
                        if n["file"] == inst_b["file"] and n.get("line") == inst_b["start_line"]:
                            node_b_id = n["id"]
                            break

                    if not node_a_id:
                        node_a_id = f"{inst_a['file']}::L{inst_a['start_line']}::clone"
                        all_nodes.append({
                            "id": node_a_id,
                            "file": inst_a["file"],
                            "symbol": inst_a["name"],
                            "line": inst_a["start_line"],
                            "kind": "clone",
                            "code": inst_a["code"],
                            "label": f"Clone ({inst_a['file']}:L{inst_a['start_line']})"
                        })
                    if not node_b_id:
                        node_b_id = f"{inst_b['file']}::L{inst_b['start_line']}::clone"
                        all_nodes.append({
                            "id": node_b_id,
                            "file": inst_b["file"],
                            "symbol": inst_b["name"],
                            "line": inst_b["start_line"],
                            "kind": "clone",
                            "code": inst_b["code"],
                            "label": f"Clone ({inst_b['file']}:L{inst_b['start_line']})"
                        })

                    all_edges.append({
                        "source": node_a_id,
                        "target": node_b_id,
                        "type": "clone"
                    })
    except Exception as e:
        pass

    # Detect Semantic Clones and add dashed cyan semantic_clone edges
    try:
        semantic_result = detect_semantic_clones_in_workspace(abs_workspace)
        for group in semantic_result.get("groups", []):
            instances = group.get("instances", [])
            for i in range(len(instances)):
                for j in range(i + 1, len(instances)):
                    inst_a = instances[i]
                    inst_b = instances[j]
                    
                    node_a_id = None
                    node_b_id = None
                    for n in all_nodes:
                        if n["file"] == inst_a["file"] and n.get("line") == inst_a["start_line"]:
                            node_a_id = n["id"]
                            break
                    for n in all_nodes:
                        if n["file"] == inst_b["file"] and n.get("line") == inst_b["start_line"]:
                            node_b_id = n["id"]
                            break

                    if not node_a_id:
                        node_a_id = f"{inst_a['file']}::L{inst_a['start_line']}::semantic_clone"
                        all_nodes.append({
                            "id": node_a_id,
                            "file": inst_a["file"],
                            "symbol": inst_a.get("pattern_name", "Semantic Clone"),
                            "line": inst_a["start_line"],
                            "kind": "semantic_clone",
                            "code": inst_a["code"],
                            "label": f"Semantic ({inst_a['file']}:L{inst_a['start_line']})"
                        })
                    if not node_b_id:
                        node_b_id = f"{inst_b['file']}::L{inst_b['start_line']}::semantic_clone"
                        all_nodes.append({
                            "id": node_b_id,
                            "file": inst_b["file"],
                            "symbol": inst_b.get("pattern_name", "Semantic Clone"),
                            "line": inst_b["start_line"],
                            "kind": "semantic_clone",
                            "code": inst_b["code"],
                            "label": f"Semantic ({inst_b['file']}:L{inst_b['start_line']})"
                        })

                    all_edges.append({
                        "source": node_a_id,
                        "target": node_b_id,
                        "type": "semantic_clone"
                    })
    except Exception as e:
        pass

    # Ensure unique edges
    seen_edges = set()
    unique_edges = []
    for e in all_edges:
        edge_key = (e["source"], e["target"], e["type"])
        if edge_key not in seen_edges:
            seen_edges.add(edge_key)
            unique_edges.append(e)

    return {
        "workspace": workspace_path,
        "nodes": all_nodes,
        "edges": unique_edges
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Workspace Provenance & Dependency Graph")
    parser.add_argument("workspace", help="Path to workspace root directory")
    args = parser.parse_args()

    result = build_workspace_graph(args.workspace)
    print(json.dumps(result, indent=2))
