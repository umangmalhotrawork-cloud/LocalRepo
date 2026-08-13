#!/usr/bin/env python3
import sys
import os
import json
import time
import tempfile
import subprocess
import argparse

def run_isolated_subprocess(file_path: str, timeout_sec: float = 3.0) -> dict:
    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, file_path],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=os.environ.copy()
        )
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "stdout": proc.stdout or "",
            "stderr": proc.stderr or "",
            "exit_code": proc.returncode,
            "exception": None,
            "duration_ms": duration_ms,
            "timed_out": False
        }
    except subprocess.TimeoutExpired as e:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "stdout": e.stdout or "",
            "stderr": f"Execution timed out after {timeout_sec}s",
            "exit_code": -1,
            "exception": "TimeoutExpired",
            "duration_ms": duration_ms,
            "timed_out": True
        }
    except Exception as e:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "stdout": "",
            "stderr": str(e),
            "exit_code": -1,
            "exception": type(e).__name__,
            "duration_ms": duration_ms,
            "timed_out": False
        }

def verify_behavior(original_path: str, transformed_source: str) -> dict:
    abs_original = os.path.abspath(original_path)
    if not os.path.exists(abs_original):
        return {
            "behavior_preserved": False,
            "original": {
                "stdout": "",
                "stderr": f"File not found: {original_path}",
                "exit_code": -1,
                "exception": "FileNotFoundError"
            },
            "transformed": {
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "exception": None
            },
            "differences": [f"Original file not found: {original_path}"]
        }

    # Run original code in isolated subprocess
    orig_res = run_isolated_subprocess(abs_original, timeout_sec=3.0)

    # Create temporary file for transformed source code
    temp_fd, temp_path = tempfile.mkstemp(suffix=".py", prefix="echonullity_verify_")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as fh:
            fh.write(transformed_source)

        # Run transformed code in isolated subprocess
        trans_res = run_isolated_subprocess(temp_path, timeout_sec=3.0)

        # Normalize trailing whitespace for comparison
        orig_stdout_norm = orig_res["stdout"].rstrip()
        trans_stdout_norm = trans_res["stdout"].rstrip()
        orig_stderr_norm = orig_res["stderr"].rstrip()
        trans_stderr_norm = trans_res["stderr"].rstrip()

        differences = []

        if orig_res["exit_code"] != trans_res["exit_code"]:
            differences.append(
                f"exit_code mismatch: original {orig_res['exit_code']} vs transformed {trans_res['exit_code']}"
            )

        if orig_stdout_norm != trans_stdout_norm:
            differences.append(
                f"stdout mismatch: original '{orig_stdout_norm}' vs transformed '{trans_stdout_norm}'"
            )

        if orig_stderr_norm != trans_stderr_norm:
            differences.append(
                f"stderr mismatch: original '{orig_stderr_norm}' vs transformed '{trans_stderr_norm}'"
            )

        if trans_res["timed_out"]:
            differences.append("transformed code timed out (3s limit)")

        behavior_preserved = (len(differences) == 0)

        return {
            "behavior_preserved": behavior_preserved,
            "original": {
                "stdout": orig_res["stdout"],
                "stderr": orig_res["stderr"],
                "exit_code": orig_res["exit_code"],
                "exception": orig_res["exception"]
            },
            "transformed": {
                "stdout": trans_res["stdout"],
                "stderr": trans_res["stderr"],
                "exit_code": trans_res["exit_code"],
                "exception": trans_res["exception"]
            },
            "differences": differences
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            original_path = payload.get("original_path") or payload.get("file")
            transformed_source = payload.get("transformed_source") or payload.get("transformed", "")
        except Exception as e:
            print(json.dumps({
                "behavior_preserved": False,
                "original": {"stdout": "", "stderr": f"Invalid JSON stdin: {e}", "exit_code": -1, "exception": "JSONDecodeError"},
                "transformed": {"stdout": "", "stderr": "", "exit_code": -1, "exception": None},
                "differences": [f"Invalid JSON stdin: {e}"]
            }))
            sys.exit(1)
    else:
        parser = argparse.ArgumentParser(description="Echo Nullity Behavioral Verification Harness")
        parser.add_argument("original_path", help="Path to original source file")
        parser.add_argument("--transformed", default=None, help="Transformed code string or path to transformed code file")
        args = parser.parse_args()
        original_path = args.original_path
        transformed_source = ""
        if args.transformed:
            if os.path.exists(args.transformed):
                with open(args.transformed, "r", encoding="utf-8") as f:
                    transformed_source = f.read()
            else:
                transformed_source = args.transformed

    result = verify_behavior(original_path, transformed_source)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
