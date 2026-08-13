#!/usr/bin/env python3
import sys
import os
import json
import time
import hashlib
import argparse
from datetime import datetime

def get_history_file_path() -> str:
    user_data_dir = os.path.expanduser("~/Library/Application Support/echo-nullity")
    target_file = os.path.join(user_data_dir, "surgery-history.json")
    try:
        os.makedirs(user_data_dir, exist_ok=True)
        with open(target_file, "a", encoding="utf-8") as f:
            pass
        return target_file
    except Exception:
        fallback_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "state"))
        os.makedirs(fallback_dir, exist_ok=True)
        return os.path.join(fallback_dir, "surgery-history.json")

def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

def list_history() -> dict:
    hist_file = get_history_file_path()
    if not os.path.exists(hist_file):
        return {"success": True, "entries": []}
    try:
        with open(hist_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            entries = data if isinstance(data, list) else data.get("entries", [])
            # Return newest entries first
            entries_sorted = sorted(entries, key=lambda x: x.get("timestamp", ""), reverse=True)
            return {"success": True, "entries": entries_sorted}
    except Exception as e:
        return {"success": False, "error": str(e), "entries": []}

def append_history(entry: dict) -> dict:
    hist_file = get_history_file_path()
    existing_res = list_history()
    entries = existing_res.get("entries", [])

    from datetime import timezone
    ts_now = datetime.now(timezone.utc).isoformat()
    entry_id = entry.get("id") or f"surg-{int(time.time())}-{hashlib.md5(str(time.time()).encode()).hexdigest()[:6]}"

    before_src = entry.get("before_source", "")
    after_src = entry.get("after_source", "")

    new_entry = {
        "id": entry_id,
        "timestamp": entry.get("timestamp") or ts_now,
        "file_path": entry.get("file_path", ""),
        "operation_type": entry.get("operation_type", "APPLY_SURGERY"),
        "removed_lines": entry.get("removed_lines", []),
        "before_hash": entry.get("before_hash") or compute_hash(before_src),
        "after_hash": entry.get("after_hash") or compute_hash(after_src),
        "before_source": before_src,
        "after_source": after_src,
        "behavior_preserved": bool(entry.get("behavior_preserved", True)),
        "luminance_before": float(entry.get("luminance_before", 0.65)),
        "luminance_after": float(entry.get("luminance_after", 1.00))
    }

    entries.insert(0, new_entry)

    try:
        with open(hist_file, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2)
        return {"success": True, "entry": new_entry}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_history(entry_id: str) -> dict:
    res = list_history()
    entries = res.get("entries", [])
    for e in entries:
        if e.get("id") == entry_id:
            return {"success": True, "entry": e}
    return {"success": False, "error": f"Entry not found: {entry_id}"}

def restore_checkpoint(entry_id: str) -> dict:
    res = get_history(entry_id)
    if not res.get("success"):
        return res

    entry = res["entry"]
    file_path = entry.get("file_path", "")
    before_source = entry.get("before_source", "")

    if not file_path:
        return {"success": False, "error": "Invalid file path in history entry"}

    abs_path = os.path.abspath(file_path)

    # Read current source before restoring
    current_source = ""
    if os.path.exists(abs_path):
        with open(abs_path, "r", encoding="utf-8") as f:
            current_source = f.read()

    # Write before_source back to disk
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(before_source)
    except Exception as e:
        return {"success": False, "error": f"Failed to restore file on disk: {e}"}

    # Append restore event to history
    restore_entry = {
        "file_path": abs_path,
        "operation_type": "RESTORE_CHECKPOINT",
        "removed_lines": [],
        "before_source": current_source,
        "after_source": before_source,
        "behavior_preserved": True,
        "luminance_before": entry.get("luminance_after", 1.0),
        "luminance_after": entry.get("luminance_before", 0.65)
    }
    append_history(restore_entry)

    return {
        "success": True,
        "file": abs_path,
        "restored_content": before_source,
        "checkpoint_id": entry_id,
        "entry": entry
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            cmd = payload.get("cmd") or payload.get("action") or "list"
            if cmd == "list":
                print(json.dumps(list_history(), indent=2))
            elif cmd == "get":
                print(json.dumps(get_history(payload.get("id")), indent=2))
            elif cmd == "append":
                print(json.dumps(append_history(payload.get("entry", payload)), indent=2))
            elif cmd == "restore":
                print(json.dumps(restore_checkpoint(payload.get("id")), indent=2))
            else:
                print(json.dumps({"success": False, "error": f"Unknown command: {cmd}"}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
    else:
        parser = argparse.ArgumentParser(description="Echo Nullity Surgery History Engine")
        parser.add_argument("action", choices=["list", "get", "append", "restore"], nargs="?", default="list")
        parser.add_argument("--id", help="Surgery entry ID")
        parser.add_argument("--file", help="Target file path")
        args = parser.parse_args()

        if args.action == "list":
            print(json.dumps(list_history(), indent=2))
        elif args.action == "get":
            print(json.dumps(get_history(args.id), indent=2))
        elif args.action == "restore":
            print(json.dumps(restore_checkpoint(args.id), indent=2))
        elif args.action == "append":
            print(json.dumps(append_history({"file_path": args.file}), indent=2))

if __name__ == "__main__":
    main()
