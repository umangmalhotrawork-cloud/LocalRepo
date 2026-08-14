# Echo Nullity — Known Limitations (Beta)

1. **Native Python Requirement for CPU/Memory Profiling**:
   - Advanced Python CPU profiling (`cProfile`) and memory profiling (`tracemalloc`) require a system `python3` binary in `PATH`. When running in purely web/Pyodide mode, fallback mock analysis is provided.

2. **File Size Threshold for Snapshots**:
   - Large individual binary files exceeding 5MB are excluded from workspace snapshots to keep snapshot serialization fast and token-efficient.

3. **Protected Directory Exclusions**:
   - Directories matching `.git/`, `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `.venv/`, and `venv/` are strictly ignored during search, snapshot, and security audit scans.

4. **Telemetry**:
   - Beta telemetry is strictly local-only and opt-in. No file contents, paths, or code strings are ever transmitted externally.
