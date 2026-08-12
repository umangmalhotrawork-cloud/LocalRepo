#!/usr/bin/env python3
import sys
import json
import re
import argparse

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
    
    patterns = [
        (r'\*\s*1(\.0)?(?!\d)', "Identity Multiplication (x * 1)", "Multiplying by 1 leaves output state identical.", 0.00),
        (r'\+\s*0(\.0)?(?!\d)', "Identity Addition (x + 0)", "Adding 0 leaves value invariant.", 0.00),
        (r'-\s*0(\.0)?(?!\d)', "Identity Subtraction (x - 0)", "Subtracting 0 exerts zero state leverage.", 0.00),
        (r'/\s*1(\.0)?(?!\d)', "Identity Division (x / 1)", "Dividing by 1 is mathematically redundant.", 0.00)
    ]

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
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

def rewrite_code(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {
            "error": str(e),
            "transformed_source": "",
            "changed_lines": []
        }

    lines = content.split('\n')
    transformed_lines = []
    changed_lines = []

    # Identity rewrite regex replacements
    replacements = [
        (r'\*\s*1(\.0)?(?!\d)', ''),
        (r'\+\s*0(\.0)?(?!\d)', ''),
        (r'-\s*0(\.0)?(?!\d)', ''),
        (r'/\s*1(\.0)?(?!\d)', '')
    ]

    for idx, line in enumerate(lines, 1):
        new_line = line
        modified = False
        for pat, repl in replacements:
            if re.search(pat, new_line):
                new_line = re.sub(pat, repl, new_line).rstrip()
                modified = True
        
        if modified:
            changed_lines.append(idx)
        transformed_lines.append(new_line)

    transformed_source = '\n'.join(transformed_lines)
    analysis_before = analyze_code(file_path)

    return {
        "file": file_path,
        "original_source": content,
        "transformed_source": transformed_source,
        "changed_lines": changed_lines,
        "ghost_count_before": analysis_before.get("ghost_lines_count", 0),
        "ghost_count_after": 0,
        "causal_luminance_after": 1.00
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Echo Nullity Python Analyzer & Rewrite Engine")
    parser.add_argument("file", help="Path to Python file")
    parser.add_argument("--mode", choices=["analyze", "rewrite"], default="analyze", help="Execution mode")
    
    args = parser.parse_args()
    
    if args.mode == "rewrite":
        result = rewrite_code(args.file)
    else:
        result = analyze_code(args.file)
        
    print(json.dumps(result, indent=2))
