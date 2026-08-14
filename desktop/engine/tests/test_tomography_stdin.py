#!/usr/bin/env python3
"""Regression test for unsaved-editor tomography analysis.

The file on disk intentionally has no findings.  The content sent over STDIN has
two anti-gravity findings, which proves tomography cannot silently read the disk
file instead of the active editor buffer.
"""

import json
import os
import subprocess
import sys
import tempfile


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ANALYZER = os.path.join(ROOT, "desktop", "engine", "analyze.py")
MAIN = os.path.join(ROOT, "desktop", "electron", "main.js")
PRELOAD = os.path.join(ROOT, "desktop", "electron", "preload.js")
RENDERER = os.path.join(ROOT, "desktop", "renderer", "IDEApp.tsx")

UNSAVED_EDITOR_CONTENT = """gravity = 0
velocity_y = 5
velocity_y += gravity
print(velocity_y)
"""
ON_DISK_CONTENT = """gravity = -9.8
velocity_y = 5
velocity_y += gravity
print(velocity_y)
"""


def test_unsaved_buffer_reaches_analyzer_over_stdin():
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as source_file:
        source_file.write(ON_DISK_CONTENT)
        file_path = source_file.name

    try:
        completed = subprocess.run(
            [sys.executable, ANALYZER, "--stdin", "--path", file_path, "--mode", "analyze"],
            input=UNSAVED_EDITOR_CONTENT,
            text=True,
            capture_output=True,
            check=True,
        )
        result = json.loads(completed.stdout)

        assert result["file"] == file_path
        assert result["ghost_lines_count"] == 2
        assert len(result["findings"]) == 2
        assert {finding["line"] for finding in result["findings"]} == {1, 3}
        assert f"[ANALYZER] path={file_path} bytes={len(UNSAVED_EDITOR_CONTENT.encode('utf-8'))}" in completed.stderr
        with open(file_path, encoding="utf-8") as disk_file:
            assert disk_file.read() == ON_DISK_CONTENT
    finally:
        os.unlink(file_path)


def test_electron_buffer_contract_is_wired_end_to_end():
    with open(MAIN, encoding="utf-8") as file:
        main_source = file.read()
    with open(PRELOAD, encoding="utf-8") as file:
        preload_source = file.read()
    with open(RENDERER, encoding="utf-8") as file:
        renderer_source = file.read()

    assert "--stdin', '--path', filePath, '--mode', 'analyze'" in main_source
    assert "child.stdin.end(content)" in main_source
    assert "analyzeFile: (payload)" in preload_source
    assert "analyzeFile({ filePath: path, content })" in renderer_source
    assert "requestId !== analysisRequestIdRef.current" in renderer_source
    assert "Electron analysis bridge is unavailable" in renderer_source


if __name__ == "__main__":
    test_unsaved_buffer_reaches_analyzer_over_stdin()
    test_electron_buffer_contract_is_wired_end_to_end()
    print("PASS: unsaved buffer reaches tomography and produces 2 findings")
