#!/usr/bin/env python3
"""
Behavioral Dependency Graph (BDG) Python AST Extractor
Parses Python source files using native `ast` and extracts normalized BDG nodes and edges.
"""

import sys
import os
import ast
import json
import argparse

def extract_python_bdg(source_code, rel_path):
    nodes = {}
    edges = []
    
    file_node_id = f"file::{rel_path}"
    nodes[file_node_id] = {
        "id": file_node_id,
        "type": "file",
        "file": rel_path,
        "symbol": os.path.basename(rel_path),
        "location": {"line": 1, "col": 1},
        "language": "python",
        "metadata": {}
    }
    
    try:
        tree = ast.parse(source_code, filename=rel_path)
    except Exception as e:
        return {"nodes": nodes, "edges": edges, "error": str(e)}

    class BDGVisitor(ast.NodeVisitor):
        def __init__(self):
            self.current_scope = [file_node_id]
            self.current_class = None
            self.defined_symbols = set()

        def visit_Import(self, node):
            for alias in node.names:
                mod_node_id = f"module::{alias.name}"
                if mod_node_id not in nodes:
                    nodes[mod_node_id] = {
                        "id": mod_node_id,
                        "type": "module",
                        "file": rel_path,
                        "symbol": alias.name,
                        "location": {"line": node.lineno, "col": node.col_offset + 1},
                        "language": "python",
                        "metadata": {"imported": True}
                    }
                edges.append({
                    "id": f"{file_node_id}->imports->{mod_node_id}::L{node.lineno}",
                    "source": file_node_id,
                    "target": mod_node_id,
                    "relationship": "imports",
                    "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                })
            self.generic_visit(node)

        def visit_ImportFrom(self, node):
            mod_name = node.module or ""
            for alias in node.names:
                full_symbol = f"{mod_name}.{alias.name}" if mod_name else alias.name
                mod_node_id = f"module::{full_symbol}"
                if mod_node_id not in nodes:
                    nodes[mod_node_id] = {
                        "id": mod_node_id,
                        "type": "module",
                        "file": rel_path,
                        "symbol": full_symbol,
                        "location": {"line": node.lineno, "col": node.col_offset + 1},
                        "language": "python",
                        "metadata": {"imported": True}
                    }
                edges.append({
                    "id": f"{file_node_id}->imports->{mod_node_id}::L{node.lineno}",
                    "source": file_node_id,
                    "target": mod_node_id,
                    "relationship": "imports",
                    "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                })
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            class_node_id = f"class::{rel_path}::{node.name}"
            is_test_class = node.name.startswith("Test") or node.name.endswith("Test") or node.name.endswith("Tests")
            node_type = "test" if is_test_class else "class"
            
            nodes[class_node_id] = {
                "id": class_node_id,
                "type": node_type,
                "file": rel_path,
                "symbol": node.name,
                "location": {"line": node.lineno, "col": node.col_offset + 1, "endLine": getattr(node, 'end_lineno', node.lineno)},
                "language": "python",
                "metadata": {"decorator_count": len(node.decorator_list)}
            }
            
            # Parent container relationship
            parent_scope = self.current_scope[-1]
            edges.append({
                "id": f"{parent_scope}->instantiates->{class_node_id}::L{node.lineno}",
                "source": parent_scope,
                "target": class_node_id,
                "relationship": "instantiates",
                "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
            })

            # Inheritance
            for base in node.bases:
                base_name = ""
                if isinstance(base, ast.Name):
                    base_name = base.id
                elif isinstance(base, ast.Attribute):
                    base_name = base.attr
                if base_name:
                    base_node_id = f"class::{rel_path}::{base_name}"
                    edges.append({
                        "id": f"{class_node_id}->inherits->{base_node_id}::L{node.lineno}",
                        "source": class_node_id,
                        "target": base_node_id,
                        "relationship": "inherits",
                        "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                    })

            self.current_scope.append(class_node_id)
            prev_class = self.current_class
            self.current_class = class_node_id
            self.generic_visit(node)
            self.current_class = prev_class
            self.current_scope.pop()

        def visit_FunctionDef(self, node):
            func_name = f"{self.current_class.split('::')[-1]}.{node.name}" if self.current_class else node.name
            func_node_id = f"function::{rel_path}::{func_name}"
            is_test_func = node.name.startswith("test_") or node.name.endswith("_test")
            node_type = "test" if is_test_func else "function"

            nodes[func_node_id] = {
                "id": func_node_id,
                "type": node_type,
                "file": rel_path,
                "symbol": func_name,
                "location": {"line": node.lineno, "col": node.col_offset + 1, "endLine": getattr(node, 'end_lineno', node.lineno)},
                "language": "python",
                "metadata": {"args": [arg.arg for arg in node.args.args]}
            }

            parent_scope = self.current_scope[-1]
            edges.append({
                "id": f"{parent_scope}->contains->{func_node_id}::L{node.lineno}",
                "source": parent_scope,
                "target": func_node_id,
                "relationship": "calls" if parent_scope.startswith("function::") else "instantiates",
                "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
            })

            self.current_scope.append(func_node_id)
            self.generic_visit(node)
            self.current_scope.pop()

        def visit_Assign(self, node):
            parent_scope = self.current_scope[-1]
            for target in node.targets:
                var_name = None
                if isinstance(target, ast.Name):
                    var_name = target.id
                elif isinstance(target, ast.Attribute):
                    var_name = target.attr

                if var_name:
                    var_node_id = f"variable::{rel_path}::{var_name}"
                    if var_node_id not in nodes:
                        nodes[var_node_id] = {
                            "id": var_node_id,
                            "type": "variable",
                            "file": rel_path,
                            "symbol": var_name,
                            "location": {"line": node.lineno, "col": node.col_offset + 1},
                            "language": "python",
                            "metadata": {}
                        }
                    edges.append({
                        "id": f"{parent_scope}->writes->{var_node_id}::L{node.lineno}",
                        "source": parent_scope,
                        "target": var_node_id,
                        "relationship": "writes",
                        "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                    })
            self.generic_visit(node)

        def visit_Name(self, node):
            if isinstance(node.ctx, ast.Load):
                parent_scope = self.current_scope[-1]
                var_name = node.id
                # Exclude python builtins
                if var_name not in {"print", "len", "range", "int", "str", "float", "dict", "list", "set", "tuple", "bool", "True", "False", "None", "self", "cls"}:
                    var_node_id = f"variable::{rel_path}::{var_name}"
                    if var_node_id in nodes or parent_scope.startswith("function::"):
                        if var_node_id not in nodes:
                            nodes[var_node_id] = {
                                "id": var_node_id,
                                "type": "variable",
                                "file": rel_path,
                                "symbol": var_name,
                                "location": {"line": node.lineno, "col": node.col_offset + 1},
                                "language": "python",
                                "metadata": {}
                            }
                        edges.append({
                            "id": f"{parent_scope}->reads->{var_node_id}::L{node.lineno}",
                            "source": parent_scope,
                            "target": var_node_id,
                            "relationship": "reads",
                            "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                        })
            self.generic_visit(node)

        def visit_Call(self, node):
            parent_scope = self.current_scope[-1]
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            if func_name:
                # Check for Database Operation
                if func_name in {"execute", "executemany", "fetchall", "fetchone", "commit", "rollback", "query"}:
                    db_node_id = f"database-op::{rel_path}::{func_name}::L{node.lineno}"
                    nodes[db_node_id] = {
                        "id": db_node_id,
                        "type": "database-op",
                        "file": rel_path,
                        "symbol": f"DB.{func_name}",
                        "location": {"line": node.lineno, "col": node.col_offset + 1},
                        "language": "python",
                        "metadata": {"operation": func_name}
                    }
                    rel = "database-write" if func_name in {"execute", "executemany", "commit"} else "database-read"
                    edges.append({
                        "id": f"{parent_scope}->{rel}->{db_node_id}::L{node.lineno}",
                        "source": parent_scope,
                        "target": db_node_id,
                        "relationship": rel,
                        "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                    })

                # Check for External API Call
                elif func_name in {"get", "post", "put", "delete", "patch", "request", "urlopen", "fetch"}:
                    api_node_id = f"external-api::{rel_path}::{func_name}::L{node.lineno}"
                    nodes[api_node_id] = {
                        "id": api_node_id,
                        "type": "external-api",
                        "file": rel_path,
                        "symbol": f"HTTP.{func_name.upper()}",
                        "location": {"line": node.lineno, "col": node.col_offset + 1},
                        "language": "python",
                        "metadata": {"method": func_name.upper()}
                    }
                    edges.append({
                        "id": f"{parent_scope}->external-call->{api_node_id}::L{node.lineno}",
                        "source": parent_scope,
                        "target": api_node_id,
                        "relationship": "external-call",
                        "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                    })

                # Regular Function Call
                else:
                    target_func_id = f"function::{rel_path}::{func_name}"
                    edges.append({
                        "id": f"{parent_scope}->calls->{func_name}::L{node.lineno}",
                        "source": parent_scope,
                        "target": target_func_id,
                        "relationship": "test-covers" if parent_scope.startswith("function::") and ("test" in parent_scope.lower()) else "calls",
                        "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                    })

            self.generic_visit(node)

        def visit_Return(self, node):
            parent_scope = self.current_scope[-1]
            if parent_scope.startswith("function::") and node.value:
                edges.append({
                    "id": f"{parent_scope}->returns-to->L{node.lineno}",
                    "source": parent_scope,
                    "target": file_node_id,
                    "relationship": "returns-to",
                    "sourceLocation": {"line": node.lineno, "col": node.col_offset + 1}
                })
            self.generic_visit(node)

    visitor = BDGVisitor()
    visitor.visit(tree)

    return {"nodes": nodes, "edges": edges}

def main():
    parser = argparse.ArgumentParser(description="Python BDG Extractor")
    parser.add_argument("file_path", help="Path to Python file")
    parser.add_argument("--rel-path", help="Relative file path", default=None)
    args = parser.parse_args()

    if not os.path.exists(args.file_path):
        print(json.dumps({"error": f"File not found: {args.file_path}"}))
        sys.exit(1)

    rel_path = args.rel_path or os.path.basename(args.file_path)
    with open(args.file_path, "r", encoding="utf-8", errors="ignore") as f:
        source_code = f.read()

    result = extract_python_bdg(source_code, rel_path)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
