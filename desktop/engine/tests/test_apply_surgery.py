#!/usr/bin/env python3
import ast
import os
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import apply_surgery


def run_surgery(source, approved_lines):
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as source_file:
        source_file.write(source)
        path = source_file.name
    try:
        result = apply_surgery.apply_surgery(path, approved_lines)
        with open(path, encoding="utf-8") as source_file:
            written_source = source_file.read()
        return result, written_source
    finally:
        for candidate in (path, f"{path}.echo-nullity-backup"):
            if os.path.exists(candidate):
                os.unlink(candidate)


def test_removes_top_level_statement_without_syntax_error():
    source = "value = 3\nvalue = value * 1\nprint(value)\n"
    result, written_source = run_surgery(source, [2])

    assert result["success"] is True
    ast.parse(written_source)
    assert "value = value * 1" not in written_source


def test_removes_statement_inside_function_without_changing_indentation():
    source = "def calculate(value):\n    value = value * 1\n    return value\n"
    result, written_source = run_surgery(source, [2])

    assert result["success"] is True
    ast.parse(written_source)
    assert written_source == "def calculate(value):\n    return value\n"


def test_removes_complete_multiline_statement_for_a_finding_inside_it():
    source = "def calculate(value):\n    result = (\n        value * 1\n    )\n    return result\n"
    result, written_source = run_surgery(source, [3])

    assert result["success"] is True
    ast.parse(written_source)
    assert written_source == "def calculate(value):\n    return result\n"


def test_empty_if_and_loop_suites_receive_indented_pass():
    source = (
        "def update(enabled, values):\n"
        "    if enabled:\n"
        "        gravity = gravity * 1\n"
        "    for value in values:\n"
        "        velocity = velocity + 0\n"
        "    return values\n"
    )
    result, written_source = run_surgery(source, [3, 5])

    assert result["success"] is True
    ast.parse(written_source)
    assert "    if enabled:\n        pass\n" in written_source
    assert "    for value in values:\n        pass\n" in written_source


def test_rejects_invalid_transformation_without_writing_source():
    source = "value = 3\nvalue = value * 1\n"
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as source_file:
        source_file.write(source)
        path = source_file.name

    real_parse = ast.parse
    calls = 0

    def fail_only_final_validation(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise SyntaxError("forced validation failure")
        return real_parse(*args, **kwargs)

    try:
        with patch.object(apply_surgery.ast, "parse", side_effect=fail_only_final_validation):
            result = apply_surgery.apply_surgery(path, [2])
        with open(path, encoding="utf-8") as source_file:
            assert source_file.read() == source
        assert result["success"] is False
        assert "Surgery rejected" in result["error"]
        assert not os.path.exists(f"{path}.echo-nullity-backup")
    finally:
        if os.path.exists(path):
            os.unlink(path)


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
        print(f"[PASS] {test.__name__}")
