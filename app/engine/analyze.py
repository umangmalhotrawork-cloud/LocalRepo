#!/usr/bin/env python3
import sys
import json
import re

def analyze_code(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        return {
            "error": str(e),
            "findings": []
        }

    findings = []
    
    # Patterns for identity operations
    patterns = [
        (r'\*\s*1(\.0)?(?!\d)', "Identity Multiplication (x * 1)", "Multiplying by 1 leaves output state identical.", 0.00),
        (r'\+\s*0(\.0)?(?!\d)', "Identity Addition (x + 0)", "Adding 0 leaves output state invariant.", 0.00),
        (r'-\s*0(\.0)?(?!\d)', "Identity Subtraction (x - 0)", "Subtracting 0 exerts zero state leverage.", 0.00),
        (r'/\s*1(\.0)?(?!\d)', "Identity Division (x / 1)", "Dividing by 1 is mathematically redundant.", 0.00)
    ]

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        # Skip empty lines or pure comment lines
        if not stripped or stripped.startswith('#'):
            continue
            
        for pat, title, reason, impact in patterns:
            if re.search(pat, line):
                findings.append({
                    "line": idx,
                    "code": line.strip(),
                    "title": title,
                    "reason": reason,
                    "luminance": impact,
                    "status": "Verified Ghost Line",
                    "category": "vacuous_identity"
                })

    return {
        "file": file_path,
        "total_lines": len(lines),
        "ghost_lines_count": len(findings),
        "causal_luminance": 0.00 if findings else 1.00,
        "findings": findings
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided", "findings": []}))
        sys.exit(1)
        
    target_file = sys.argv[1]
    result = analyze_code(target_file)
    print(json.dumps(result, indent=2))
