#!/usr/bin/env python3
"""
Echo Nullity — Unit Tests for Behavioral Fingerprint Engine
"""

import os
import sys
import json
import unittest
import tempfile

# Ensure engine directory is in sys.path
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from behavior_fingerprint import (
    discover_functions,
    generate_input_matrix,
    normalize_value,
    compute_fingerprint_hash,
    generate_behavioral_fingerprint,
    compare_fingerprints
)

class TestBehavioralFingerprint(unittest.TestCase):

    def test_1_function_discovery(self):
        source = "def add(a, b):\n    return a + b\ndef hello():\n    print('hi')"
        discovered = discover_functions(source)
        self.assertEqual(len(discovered), 2)
        self.assertEqual(discovered[0]["name"], "add")
        self.assertEqual(discovered[0]["parameters"], ["a", "b"])
        self.assertEqual(discovered[1]["name"], "hello")

    def test_2_deterministic_input_generation(self):
        matrix_0 = generate_input_matrix([], 0)
        self.assertEqual(matrix_0, [[]])

        matrix_1 = generate_input_matrix(["x"], 1)
        self.assertGreater(len(matrix_1), 0)
        self.assertEqual(matrix_1[0], [0])

        matrix_2 = generate_input_matrix(["a", "b"], 2)
        self.assertGreater(len(matrix_2), 0)
        # Verify determinism
        self.assertEqual(matrix_2, generate_input_matrix(["a", "b"], 2))

    def test_3_successful_execution_and_normalization(self):
        norm_int = normalize_value(42)
        self.assertEqual(norm_int, {"type": "int", "value": 42})

        norm_str = normalize_value("hello")
        self.assertEqual(norm_str, {"type": "str", "value": "hello"})

        norm_none = normalize_value(None)
        self.assertEqual(norm_none, {"type": "none", "value": None})

    def test_4_exception_capture(self):
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write("def raise_err(x):\n    raise ValueError('Test error')\n")
            fpath = f.name
        try:
            fp = generate_behavioral_fingerprint(fpath)
            self.assertEqual(fp["functions_count"], 1)
            fn = fp["functions"][0]
            self.assertGreater(fn["exception_count"], 0)
            obs = fn["observations"][0]
            self.assertEqual(obs["status"], "exception")
            self.assertEqual(obs["exception_type"], "ValueError")
        finally:
            if os.path.exists(fpath):
                os.remove(fpath)

    def test_5_timeout_handling(self):
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write("import time\ndef infinite_loop(x):\n    time.sleep(10)\n")
            fpath = f.name
        try:
            # Override timeout for quick test
            from behavior_fingerprint import execute_function_isolated
            obs = execute_function_isolated(fpath, "infinite_loop", [1], timeout_sec=0.5)
            self.assertEqual(obs["status"], "timeout")
        finally:
            if os.path.exists(fpath):
                os.remove(fpath)

    def test_6_deterministic_fingerprint_hash(self):
        obs1 = [{"input": [{"type": "int", "value": 1}], "status": "success", "output": {"type": "int", "value": 2}}]
        obs2 = [{"input": [{"type": "int", "value": 1}], "status": "success", "output": {"type": "int", "value": 2}}]
        h1 = compute_fingerprint_hash(obs1)
        h2 = compute_fingerprint_hash(obs2)
        self.assertEqual(h1, h2)

    def test_7_fingerprint_comparison(self):
        fp_a = {
            "functions": [
                {
                    "name": "calc",
                    "observations": [
                        {"input": [{"type": "int", "value": 1}], "status": "success", "output": {"type": "int", "value": 2}}
                    ]
                }
            ]
        }
        fp_b = {
            "functions": [
                {
                    "name": "calc",
                    "observations": [
                        {"input": [{"type": "int", "value": 1}], "status": "success", "output": {"type": "int", "value": 4}}
                    ]
                }
            ]
        }
        diff = compare_fingerprints(fp_a, fp_b)
        self.assertTrue(diff["changed"])
        self.assertEqual(diff["changed_observations"], 1)

    def test_8_malformed_source_handling(self):
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write("def malformed_syntax(\n")
            fpath = f.name
        try:
            fp = generate_behavioral_fingerprint(fpath)
            self.assertEqual(fp["functions_count"], 0)
        finally:
            if os.path.exists(fpath):
                os.remove(fpath)

    def test_9_empty_source_handling(self):
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write("# empty file\n")
            fpath = f.name
        try:
            fp = generate_behavioral_fingerprint(fpath)
            self.assertEqual(fp["functions_count"], 0)
        finally:
            if os.path.exists(fpath):
                os.remove(fpath)

if __name__ == "__main__":
    unittest.main()
