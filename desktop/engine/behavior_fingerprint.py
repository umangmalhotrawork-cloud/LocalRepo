#!/usr/bin/env python3
"""
Echo Nullity — Behavioral Fingerprint Engine (Phase 1)
Discovers Python functions, generates deterministic representative inputs,
executes them in isolated subprocesses, normalizes outputs/exceptions,
calculates canonical fingerprint hashes, and provides fingerprint comparison.
"""

import sys
import os
import ast
import json
import time
import hashlib
import tempfile
import subprocess
import argparse
from datetime import datetime, timezone

SCHEMA_VERSION = 1
DEFAULT_TIMEOUT_SEC = 2.0

# Deterministic representative candidates per type category
CANDIDATES_MAP = {
    "int": [0, 1, -1, 2, 10],
    "float": [0.0, 1.0, -1.0, 2.5],
    "bool": [True, False],
    "str": ["", "a", "test"],
    "list": [[], [1], [1, 2]],
    "dict": [{}, {"key": "value"}],
    "none": [None]
}

def discover_functions(source_code: str) -> list:
    """Uses Python AST to discover top-level function definitions."""
    try:
        tree = ast.parse(source_code)
    except Exception as e:
        return []

    lines = source_code.splitlines()
    functions = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Skip private/internal double-underscore helpers if not standard
            name = node.name
            start_line = getattr(node, "lineno", 1)
            end_line = getattr(node, "end_lineno", start_line)
            params = [arg.arg for arg in node.args.args]
            
            # Extract function source snippet for source hashing
            fn_lines = lines[start_line - 1:end_line]
            fn_source = "\n".join(fn_lines)
            fn_hash = hashlib.sha256(fn_source.encode("utf-8")).hexdigest()[:16]

            functions.append({
                "name": name,
                "line": start_line,
                "end_line": end_line,
                "parameters": params,
                "param_count": len(params),
                "source_hash": fn_hash,
                "ast_node": node
            })

    # Sort functions by start line
    functions.sort(key=lambda f: f["line"])
    return functions

def generate_input_matrix(params: list, param_count: int) -> list:
    """Generates a bounded, deterministic test input matrix for function arguments."""
    if param_count == 0:
        return [[]]

    # Deterministic base pool for unannotated parameters
    default_pool = [0, 1, 10, "test", True, [1, 2], {"key": "val"}, None]

    if param_count == 1:
        return [[val] for val in [0, 1, -1, 10, "test", "", True, False, [1, 2], None]]

    if param_count == 2:
        # Bounded pairwise matrix (12 combinations)
        inputs = []
        p1_values = [0, 1, 10, "test"]
        p2_values = [0, 1, "test", True]
        for v1 in p1_values:
            for v2 in p2_values:
                inputs.append([v1, v2])
        return inputs

    # For 3+ parameters, generate a bounded set of parallel test tuples
    matrix = []
    base_samples = [
        [0] * param_count,
        [1] * param_count,
        [10] * param_count,
        ["test"] * param_count,
        [True] * param_count,
    ]
    for sample in base_samples:
        matrix.append(sample)
    return matrix

def normalize_value(val) -> dict:
    """Converts Python runtime values into JSON-safe deterministic representations."""
    if val is None:
        return {"type": "none", "value": None}
    if isinstance(val, bool):
        return {"type": "bool", "value": val}
    if isinstance(val, int):
        return {"type": "int", "value": val}
    if isinstance(val, float):
        return {"type": "float", "value": round(val, 6)}
    if isinstance(val, str):
        return {"type": "str", "value": val}
    if isinstance(val, list):
        return {"type": "list", "value": [normalize_value(x) for x in val]}
    if isinstance(val, dict):
        return {"type": "dict", "value": {str(k): normalize_value(v) for k, v in val.items()}}
    return {"type": "unsupported", "value": str(val)}

def execute_function_isolated(file_path: str, function_name: str, args_list: list, timeout_sec: float = DEFAULT_TIMEOUT_SEC) -> dict:
    """Executes a target function with given arguments in an isolated Python subprocess."""
    runner_code = f"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath({repr(file_path)})))
import {os.path.splitext(os.path.basename(file_path))[0]} as target_module

try:
    fn = getattr(target_module, {repr(function_name)})
    args = json.loads({repr(json.dumps(args_list))})
    res = fn(*args)
    print("RESULT_JSON:" + json.dumps({{"status": "success", "result": res}}))
except Exception as e:
    print("RESULT_JSON:" + json.dumps({{"status": "exception", "exception_type": type(e).__name__, "message": str(e)}}))
"""

    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, "-c", runner_code],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=os.environ.copy()
        )
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Parse RESULT_JSON from stdout
        for line in proc.stdout.splitlines():
            if line.startswith("RESULT_JSON:"):
                payload = json.loads(line[12:])
                if payload.get("status") == "success":
                    return {
                        "input": [normalize_value(a) for a in args_list],
                        "status": "success",
                        "output": normalize_value(payload.get("result")),
                        "duration_ms": duration_ms
                    }
                else:
                    return {
                        "input": [normalize_value(a) for a in args_list],
                        "status": "exception",
                        "exception_type": payload.get("exception_type", "Exception"),
                        "message": payload.get("message", "Runtime exception"),
                        "duration_ms": duration_ms
                    }

        # If no RESULT_JSON, return error payload
        return {
            "input": [normalize_value(a) for a in args_list],
            "status": "exception",
            "exception_type": "SubprocessError",
            "message": proc.stderr.strip() or "No output returned from function invocation",
            "duration_ms": duration_ms
        }
    except subprocess.TimeoutExpired:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "input": [normalize_value(a) for a in args_list],
            "status": "timeout",
            "message": f"Execution timed out after {timeout_sec}s",
            "duration_ms": duration_ms
        }
    except Exception as e:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "input": [normalize_value(a) for a in args_list],
            "status": "exception",
            "exception_type": type(e).__name__,
            "message": str(e),
            "duration_ms": duration_ms
        }

def compute_fingerprint_hash(observations: list) -> str:
    """Computes a canonical SHA-256 hash for a function's observations (excluding timestamps)."""
    canonical_obs = []
    for obs in observations:
        canonical_obs.append({
            "input": obs.get("input"),
            "status": obs.get("status"),
            "output": obs.get("output"),
            "exception_type": obs.get("exception_type"),
            "message": obs.get("message")
        })

    serialized = json.dumps(canonical_obs, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

def generate_behavioral_fingerprint(file_path: str) -> dict:
    """Generates a complete behavioral fingerprint for all functions in a Python source file."""
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return {
            "error": f"File not found: {file_path}",
            "schema_version": SCHEMA_VERSION,
            "file_path": file_path,
            "functions": []
        }

    with open(abs_path, "r", encoding="utf-8") as f:
        source_code = f.read()

    file_hash = hashlib.sha256(source_code.encode("utf-8")).hexdigest()[:16]
    discovered = discover_functions(source_code)
    fn_fingerprints = []

    for fn in discovered:
        input_matrix = generate_input_matrix(fn["parameters"], fn["param_count"])
        observations = []

        for args_tuple in input_matrix:
            obs = execute_function_isolated(abs_path, fn["name"], args_tuple)
            observations.append(obs)

        fn_hash = compute_fingerprint_hash(observations)
        fn_fingerprints.append({
            "name": fn["name"],
            "line": fn["line"],
            "end_line": fn["end_line"],
            "parameters": fn["parameters"],
            "param_count": fn["param_count"],
            "source_hash": fn["source_hash"],
            "observations_count": len(observations),
            "success_count": sum(1 for o in observations if o.get("status") == "success"),
            "exception_count": sum(1 for o in observations if o.get("status") == "exception"),
            "timeout_count": sum(1 for o in observations if o.get("status") == "timeout"),
            "observations": observations,
            "fingerprint_hash": fn_hash
        })

    return {
        "schema_version": SCHEMA_VERSION,
        "file_path": abs_path,
        "file_name": os.path.basename(abs_path),
        "source_hash": file_hash,
        "functions_count": len(fn_fingerprints),
        "functions": fn_fingerprints,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

def compare_fingerprints(fp_a: dict, fp_b: dict) -> dict:
    """Compares two behavioral fingerprints and returns a structured behavioral diff."""
    funcs_a = {f["name"]: f for f in fp_a.get("functions", [])}
    funcs_b = {f["name"]: f for f in fp_b.get("functions", [])}

    all_fn_names = sorted(list(set(funcs_a.keys()) | set(funcs_b.keys())))
    differences = []
    total_obs = 0
    changed_obs = 0

    for name in all_fn_names:
        f_a = funcs_a.get(name)
        f_b = funcs_b.get(name)

        if not f_a:
            differences.append({
                "function": name,
                "type": "added_function",
                "description": f"Function '{name}' added in second fingerprint"
            })
            continue

        if not f_b:
            differences.append({
                "function": name,
                "type": "removed_function",
                "description": f"Function '{name}' removed in second fingerprint"
            })
            continue

        obs_a = f_a.get("observations", [])
        obs_b = f_b.get("observations", [])
        total_obs += max(len(obs_a), len(obs_b))

        # Map observations by canonical input representation
        map_a = {json.dumps(o.get("input"), sort_keys=True): o for o in obs_a}
        map_b = {json.dumps(o.get("input"), sort_keys=True): o for o in obs_b}

        for inp_str, o_a in map_a.items():
            o_b = map_b.get(inp_str)
            if not o_b:
                changed_obs += 1
                differences.append({
                    "function": name,
                    "type": "missing_observation",
                    "input": o_a.get("input"),
                    "description": f"Observation for input {inp_str} missing in target fingerprint"
                })
                continue

            status_a = o_a.get("status")
            status_b = o_b.get("status")
            output_a = o_a.get("output")
            output_b = o_b.get("output")

            if status_a != status_b or output_a != output_b:
                changed_obs += 1
                differences.append({
                    "function": name,
                    "type": "behavior_change",
                    "input": o_a.get("input"),
                    "status_a": status_a,
                    "status_b": status_b,
                    "output_a": output_a,
                    "output_b": output_b,
                    "message_a": o_a.get("message"),
                    "message_b": o_b.get("message"),
                    "description": f"Function '{name}' behavior changed for input {inp_str}"
                })

    unchanged_obs = max(0, total_obs - changed_obs)
    has_changes = len(differences) > 0

    return {
        "changed": has_changes,
        "total_observations": total_obs,
        "changed_observations": changed_obs,
        "unchanged_observations": unchanged_obs,
        "differences_count": len(differences),
        "differences": differences
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            payload = json.loads(sys.stdin.read())
            cmd = payload.get("cmd", "fingerprint")
            if cmd == "compare":
                fp_a = payload.get("fingerprint_a", {})
                fp_b = payload.get("fingerprint_b", {})
                res = compare_fingerprints(fp_a, fp_b)
            else:
                file_path = payload.get("file_path") or payload.get("file")
                res = generate_behavioral_fingerprint(file_path)
        except Exception as e:
            res = {"error": f"JSON stdin decode error: {e}"}
        print(json.dumps(res, indent=2))
        return

    parser = argparse.ArgumentParser(description="Echo Nullity Behavioral Fingerprint Engine")
    parser.add_argument("file_path", nargs="?", default=None, help="Path to target Python source file")
    parser.add_argument("--compare", nargs=2, metavar=("FILE_A", "FILE_B"), help="Compare behavioral fingerprints of two files")
    args = parser.parse_args()

    if args.compare:
        fp_a = generate_behavioral_fingerprint(args.compare[0])
        fp_b = generate_behavioral_fingerprint(args.compare[1])
        res = compare_fingerprints(fp_a, fp_b)
    elif args.file_path:
        res = generate_behavioral_fingerprint(args.file_path)
    else:
        res = {"error": "No file path provided. Usage: behavior_fingerprint.py <file_path> or --json"}

    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
