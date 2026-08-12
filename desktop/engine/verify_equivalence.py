#!/usr/bin/env python3
import sys
import os
import json
import time
import tempfile
import subprocess
import argparse

def execute_script(file_path, timeout_sec=10):
    start = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, file_path],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=os.environ.copy()
        )
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "duration_ms": duration_ms,
            "timed_out": False
        }
    except subprocess.TimeoutExpired as e:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "exit_code": -1,
            "stdout": e.stdout or "",
            "stderr": f"Execution timed out after {timeout_sec}s",
            "duration_ms": duration_ms,
            "timed_out": True
        }
    except Exception as e:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "duration_ms": duration_ms,
            "timed_out": False
        }

def verify_equivalence(original_file, transformed_source):
    if not os.path.exists(original_file):
        return {
            "verified": False,
            "status": "FILE_NOT_FOUND",
            "error": f"Original file not found: {original_file}",
            "original": None,
            "transformed": None,
            "delta_ms": 0.0,
            "outputs_match": False
        }

    # Execute original script
    orig_res = execute_script(original_file)

    # Write transformed script to a temporary file
    temp_fd, temp_path = tempfile.mkstemp(suffix=".py", prefix="echonullity_verify_")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            f.write(transformed_source)

        # Execute transformed script
        trans_res = execute_script(temp_path)

        # Compare behaviors
        exit_match = (orig_res["exit_code"] == trans_res["exit_code"])
        stdout_match = (orig_res["stdout"] == trans_res["stdout"])
        stderr_match = (orig_res["stderr"] == trans_res["stderr"])
        outputs_match = stdout_match and stderr_match
        verified = exit_match and outputs_match and not trans_res["timed_out"]

        delta_ms = round(trans_res["duration_ms"] - orig_res["duration_ms"], 2)

        return {
            "verified": verified,
            "status": "BEHAVIORAL_EQUIVALENCE_CONFIRMED" if verified else "BEHAVIORAL_DIVERGENCE_DETECTED",
            "original": orig_res,
            "transformed": trans_res,
            "delta_ms": delta_ms,
            "outputs_match": outputs_match
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Behavioral Equivalence Verifier")
    parser.add_argument("original_file", help="Path to original python file")
    parser.add_argument("transformed", nargs="?", default=None, help="Transformed code or path to transformed file")
    parser.add_argument("--file", dest="transformed_file", default=None, help="Path to transformed file")

    args = parser.parse_args()

    transformed_code = ""
    if args.transformed_file and os.path.exists(args.transformed_file):
        with open(args.transformed_file, "r", encoding="utf-8") as f:
            transformed_code = f.read()
    elif args.transformed:
        if os.path.exists(args.transformed):
            with open(args.transformed, "r", encoding="utf-8") as f:
                transformed_code = f.read()
        else:
            transformed_code = args.transformed
    elif not sys.stdin.isatty():
        transformed_code = sys.stdin.read()
    else:
        # Fallback to reading original file
        if os.path.exists(args.original_file):
            with open(args.original_file, "r", encoding="utf-8") as f:
                transformed_code = f.read()

    result = verify_equivalence(args.original_file, transformed_code)
    print(json.dumps(result, indent=2))
