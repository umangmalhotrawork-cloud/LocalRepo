#!/usr/bin/env python3
import sys
import os
import json
import argparse

def undo_surgery(file_path: str) -> dict:
    abs_path = os.path.abspath(file_path)
    backup_path = f"{abs_path}.echo-nullity-backup"

    if not os.path.exists(backup_path):
        return {
            "success": False,
            "error": f"No backup file found at: {backup_path}",
            "file": abs_path,
            "restored_content": None,
            "backup_path": backup_path,
        }

    try:
        with open(backup_path, "r", encoding="utf-8") as bfh:
            restored_content = bfh.read()

        with open(abs_path, "w", encoding="utf-8") as fh:
            fh.write(restored_content)

        return {
            "success": True,
            "file": abs_path,
            "restored_content": restored_content,
            "backup_path": backup_path,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to restore backup: {e}",
            "file": abs_path,
            "restored_content": None,
            "backup_path": backup_path,
        }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            file_path = payload.get("file")
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Invalid JSON stdin: {e}"}))
            sys.exit(1)
    else:
        parser = argparse.ArgumentParser(description="Echo Nullity Undo Surgery Engine")
        parser.add_argument("file", help="Path to source file to restore from backup")
        args = parser.parse_args()
        file_path = args.file

    result = undo_surgery(file_path)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
