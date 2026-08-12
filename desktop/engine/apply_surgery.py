#!/usr/bin/env python3
import sys
import os
import json
import hashlib
import argparse

def compute_sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

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

    # Create backup file
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

    lines = original_content.splitlines(keepends=True)
    approved_set = set(int(l) for l in approved_lines)
    
    new_lines = []
    removed_count = 0

    for idx, line in enumerate(lines, start=1):
        if idx in approved_set:
            removed_count += 1
            # Skip this line (surgery deletion)
            continue
        new_lines.append(line)

    transformed_content = "".join(new_lines)

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
        "removed_count": removed_count,
        "backup_path": backup_path,
        "new_hash": new_hash,
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
