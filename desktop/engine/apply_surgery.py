#!/usr/bin/env python3
import sys
import os
import json
import hashlib
import argparse
import ast

def compute_sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def simplified_identity_operand(expression):
    if not isinstance(expression, ast.BinOp):
        return None
    if isinstance(expression.op, ast.Mult):
        if isinstance(expression.right, ast.Constant) and expression.right.value == 1:
            return expression.left
        if isinstance(expression.left, ast.Constant) and expression.left.value == 1:
            return expression.right
    elif isinstance(expression.op, ast.Add):
        if isinstance(expression.right, ast.Constant) and expression.right.value == 0:
            return expression.left
        if isinstance(expression.left, ast.Constant) and expression.left.value == 0:
            return expression.right
    elif isinstance(expression.op, ast.Sub):
        if isinstance(expression.right, ast.Constant) and expression.right.value == 0:
            return expression.left
    elif isinstance(expression.op, ast.Div):
        if isinstance(expression.right, ast.Constant) and expression.right.value == 1:
            return expression.left
    return None


def simplify_identity_statement(statement, source_lines):
    """Return a source-preserving one-line identity simplification, if possible."""
    expression = statement.value if isinstance(statement, (ast.Assign, ast.AnnAssign)) else None
    operand = simplified_identity_operand(expression)
    if not operand or expression.lineno != expression.end_lineno or operand.lineno != operand.end_lineno:
        return None
    target = (
        statement.targets[0]
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1
        else statement.target if isinstance(statement, ast.AnnAssign) else None
    )
    if isinstance(target, ast.Name) and isinstance(operand, ast.Name) and target.id == operand.id:
        return None

    source_line = source_lines[expression.lineno - 1]
    original_bytes = source_line.encode("utf-8")
    operand_source = ast.get_source_segment("".join(source_lines), operand)
    if operand_source is None:
        return None
    replaced = (
        original_bytes[:expression.col_offset]
        + operand_source.encode("utf-8")
        + original_bytes[expression.end_col_offset:]
    )
    return expression.lineno, replaced.decode("utf-8")


def transform_source(original_content: str, approved_lines: list, file_path: str) -> str:
    """Simplify approved identities and safely remove other approved statements."""
    tree = ast.parse(original_content, filename=file_path)
    source_lines = original_content.splitlines(keepends=True)
    approved_set = {int(line) for line in approved_lines}
    statements = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.stmt) and hasattr(node, "lineno") and hasattr(node, "end_lineno")
    ]

    lines_to_remove = set()
    line_replacements = {}
    unmatched_lines = []
    for approved_line in approved_set:
        matches = [
            node for node in statements
            if node.lineno <= approved_line <= node.end_lineno
        ]
        if not matches:
            unmatched_lines.append(approved_line)
            continue
        # A finding can occur inside a multi-line expression. Operate on its
        # smallest enclosing statement, never just the physical finding line.
        statement = min(matches, key=lambda node: (node.end_lineno - node.lineno, node.lineno))
        replacement = simplify_identity_statement(statement, source_lines)
        if replacement:
            line_number, replacement_line = replacement
            line_replacements[line_number] = replacement_line
        else:
            lines_to_remove.update(range(statement.lineno, statement.end_lineno + 1))

    if unmatched_lines:
        raise ValueError(f"No Python statement found for approved line(s): {sorted(unmatched_lines)}")

    replacements = {}
    for owner in ast.walk(tree):
        if isinstance(owner, ast.Module):
            continue
        for _, value in ast.iter_fields(owner):
            if not (isinstance(value, list) and value and all(isinstance(item, ast.stmt) for item in value)):
                continue
            owner_start = getattr(owner, "lineno", None)
            owner_end = getattr(owner, "end_lineno", None)
            if owner_start and owner_end and all(line in lines_to_remove for line in range(owner_start, owner_end + 1)):
                continue
            if not all(
                all(line in lines_to_remove for line in range(statement.lineno, statement.end_lineno + 1))
                for statement in value
            ):
                continue

            first_line = min(statement.lineno for statement in value)
            original_line = source_lines[first_line - 1]
            indentation = original_line[:len(original_line) - len(original_line.lstrip(" \t"))]
            line_ending = "\r\n" if original_line.endswith("\r\n") else "\n" if original_line.endswith("\n") else ""
            replacements[first_line] = f"{indentation}pass{line_ending}"

    transformed_lines = []
    for line_number, line in enumerate(source_lines, start=1):
        if line_number in replacements:
            transformed_lines.append(replacements[line_number])
        elif line_number in line_replacements:
            transformed_lines.append(line_replacements[line_number])
        elif line_number not in lines_to_remove:
            transformed_lines.append(line)

    transformed_content = "".join(transformed_lines)
    # The final guard is intentionally before backup/write so a failed surgery can
    # never replace the editor's source with syntactically invalid Python.
    ast.parse(transformed_content, filename=file_path)
    return transformed_content

def apply_surgery(file_path: str, approved_lines: list) -> dict:
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return {
            "success": False,
            "error": f"File not found: {file_path}",
            "removed_count": 0,
            "backup_path": None,
            "new_hash": None,
            "transformed_content": None,
        }

    try:
        with open(abs_path, "r", encoding="utf-8") as fh:
            original_content = fh.read()
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read file: {e}",
            "removed_count": 0,
            "backup_path": None,
            "new_hash": None,
            "transformed_content": None,
        }

    try:
        transformed_content = transform_source(original_content, approved_lines, abs_path)
    except Exception as e:
        return {
            "success": False,
            "error": f"Surgery rejected: transformed Python is invalid or unsafe: {e}",
            "removed_count": 0,
            "backup_path": None,
            "new_hash": None,
            "transformed_content": None,
        }

    # Create a backup only after the proposed source is known to parse correctly.
    backup_path = f"{abs_path}.echo-nullity-backup"
    try:
        with open(backup_path, "w", encoding="utf-8") as bfh:
            bfh.write(original_content)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to write backup file: {e}",
            "removed_count": 0,
            "backup_path": None,
            "new_hash": None,
            "transformed_content": None,
        }

    try:
        with open(abs_path, "w", encoding="utf-8") as fh:
            fh.write(transformed_content)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to write transformed file: {e}",
            "removed_count": 0,
            "backup_path": backup_path,
            "new_hash": None,
            "transformed_content": None,
        }

    new_hash = compute_sha256(transformed_content)

    return {
        "success": True,
        "file": abs_path,
        "removed_count": len(approved_lines),
        "backup_path": backup_path,
        "new_hash": new_hash,
        "original_source": original_content,
        "transformed_content": transformed_content,
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            file_path = payload.get("file")
            approved_lines = payload.get("approved_lines", [])
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Invalid JSON stdin: {e}"}))
            sys.exit(1)
    else:
        parser = argparse.ArgumentParser(description="Echo Nullity Apply Surgery Engine")
        parser.add_argument("file", help="Path to source file")
        parser.add_argument("--lines", nargs="*", type=int, default=[], help="Approved line numbers to remove")
        args = parser.parse_args()
        file_path = args.file
        approved_lines = args.lines

    result = apply_surgery(file_path, approved_lines)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
