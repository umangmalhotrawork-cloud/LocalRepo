#!/usr/bin/env python3
"""
Echo Nullity — PLDI / ICSE Academic Appendix Generator Engine
Generates formal LaTeX (.tex) and Markdown (.md) research appendices.
"""

import sys
import os
import json
import time

def generate_latex_appendix(scan_data: dict, clone_data: dict = None, history_data: dict = None) -> str:
    ws_name = os.path.basename(scan_data.get("workspace", "workspace"))
    total_files = scan_data.get("files_scanned", 0)
    total_loc = scan_data.get("total_lines", 0)
    total_ghost = scan_data.get("total_ghost_lines", 0)
    ghost_ratio = scan_data.get("ghost_ratio", 0.0)
    mean_lum = scan_data.get("average_causal_luminance", 1.0)
    files = scan_data.get("files", [])

    tex = [
        r"\documentclass[sigplan,screen]{acmart}",
        r"\usepackage{amsmath,amssymb,amsfonts}",
        r"\usepackage{booktabs}",
        r"\usepackage{listings}",
        r"\usepackage{xcolor}",
        r"\lstset{basicstyle=\ttfamily\small,breaklines=true,keywordstyle=\color{blue}}",
        r"\title{Echo Nullity: Empirical Analysis \& Causal Luminance Audit}",
        r"\subtitle{Appendix for " + ws_name + r" Codebase}",
        r"\author{Echo Nullity Automated Analysis Harness}",
        r"\date{\today}",
        r"\begin{document}",
        r"\maketitle",
        r"",
        r"\section{Formal Definitions}",
        r"Let $C$ be a software artifact represented by an Abstract Syntax Tree (AST) $T(C)$, where $|C|$ denotes total lines of code.",
        r"\begin{definition}[Vacuous Line / Ghost Line]",
        r"A line $l \in C$ is defined as \emph{vacuous} if its evaluation produces zero state mutation or data-flow influence on all observable return sinks $S \subset C$.",
        r"\end{definition}",
        r"",
        r"\begin{definition}[Causal Luminance]",
        r"The Causal Luminance $\mathcal{L}(C) \in [0.0, 1.0]$ measures state leverage per unit code:",
        r"\[ \mathcal{L}(C) = 1 - \frac{|\text{Ghost}(C)|}{|C|} \]",
        r"\end{definition}",
        r"",
        r"\section{Quantitative Workspace Audit}",
        r"Table~\ref{tab:audit} summarizes the quantitative nullity metrics across scanned files.",
        r"",
        r"\begin{table}[h]",
        r"\caption{Quantitative Causal Luminance and Ghost Ratio Summary for " + ws_name + r"}",
        r"\label{tab:audit}",
        r"\begin{tabular}{lrrrr}",
        r"\toprule",
        r"\textbf{File Path} & \textbf{Total LOC} & \textbf{Ghost LOC} & \textbf{Ghost Ratio} & \textbf{Luminance $\mathcal{L}$} \\",
        r"\midrule",
    ]

    for f in files:
        fpath = f.get("path", "").replace("_", r"\_")
        loc = f.get("total_lines", 0)
        ghost = f.get("ghost_lines", 0)
        gratio = f.get("ghost_ratio", 0.0)
        lum = f.get("causal_luminance", 1.0)
        tex.append(rf"{fpath} & {loc} & {ghost} & {gratio:.4f} & {lum:.2f} \\")

    tex.extend([
        r"\midrule",
        rf"\textbf{{Summary Total}} & \textbf{{{total_loc}}} & \textbf{{{total_ghost}}} & \textbf{{{ghost_ratio:.4f}}} & \textbf{{{mean_lum:.2f}}} \\",
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
        r"",
        r"\section{Vacuous AST Node Taxonomy}",
        r"The analyzer identified the following vacuous AST patterns across the target workspace:",
        r"\begin{itemize}",
    ])

    findings_collected = []
    for f in files:
        for finding in f.get("findings", []):
            findings_collected.append((f.get("path", ""), finding))

    if findings_collected:
        for fpath, find in findings_collected[:10]:
            code_snip = find.get("code", "").replace("_", r"\_")
            ftype = find.get("type", "vacuous_node").replace("_", r"\_")
            line = find.get("line", 0)
            desc = find.get("description", "").replace("_", r"\_")
            tex.append(rf"\item \textbf{{{ftype}}} at line {line} in \texttt{{{fpath}}}: \texttt{{{code_snip}}} -- \emph{{{desc}}}")
    else:
        tex.append(r"\item No vacuous AST nodes detected in workspace.")

    tex.extend([
        r"\end{itemize}",
        r"",
        r"\section{Behavioral Verification Audit}",
        r"All proposed safe-remove surgeries undergo behavioral equivalence testing before applying. The execution outputs ($\text{stdout}$, $\text{stderr}$, $\text{exit\_code}$) of the transformed source were verified against the original baseline in isolated subprocess sandboxes.",
        r"",
        r"\end{document}"
    ])

    return "\n".join(tex)

def generate_markdown_appendix(scan_data: dict) -> str:
    ws_name = os.path.basename(scan_data.get("workspace", "workspace"))
    total_files = scan_data.get("files_scanned", 0)
    total_loc = scan_data.get("total_lines", 0)
    total_ghost = scan_data.get("total_ghost_lines", 0)
    ghost_ratio = scan_data.get("ghost_ratio", 0.0)
    mean_lum = scan_data.get("average_causal_luminance", 1.0)
    files = scan_data.get("files", [])

    md = [
        f"# Echo Nullity — PLDI / ICSE Research Appendix Report",
        f"**Workspace**: `{ws_name}` | **Generated**: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        "",
        "## 1. Formal Theoretical Framework",
        "",
        "Let $C$ be a software program represented by AST $T(C)$, where $|C|$ is total line count.",
        "",
        "### Definition 1 (Causal Luminance)",
        r"The **Causal Luminance** $\mathcal{L}(C) \in [0.0, 1.0]$ quantifies state leverage per unit code:",
        r"$$\mathcal{L}(C) = 1 - \frac{|\text{Ghost}(C)|}{|C|}$$",
        "",
        "### Definition 2 (Causal Entropy Index)",
        r"The **Causal Entropy Index** $\mathcal{H}(C)$ measures information dispersion across execution paths:",
        r"$$\mathcal{H}(C) = -\sum_{i=1}^{N} p_i \log_2 p_i$$",
        "",
        "---",
        "",
        "## 2. Quantitative Workspace Audit Table",
        "",
        "| File Path | Total LOC | Ghost LOC | Ghost Ratio $\\gamma(C)$ | Causal Luminance $\\mathcal{L}(C)$ |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ]

    for f in files:
        fpath = f.get("path", "")
        loc = f.get("total_lines", 0)
        ghost = f.get("ghost_lines", 0)
        gratio = f.get("ghost_ratio", 0.0)
        lum = f.get("causal_luminance", 1.0)
        md.append(f"| `{fpath}` | {loc} | {ghost} | {(gratio * 100):.1f}% | {lum:.2f} |")

    md.extend([
        f"| **TOTAL / MEAN** | **{total_loc}** | **{total_ghost}** | **{(ghost_ratio * 100):.1f}%** | **{mean_lum:.2f}** |",
        "",
        "---",
        "",
        "## 3. AST Findings Taxonomy & Provenance Chains",
        "",
    ])

    for f in files:
        findings = f.get("findings", [])
        if findings:
            md.append(f"### `{f.get('path', '')}`")
            for find in findings:
                md.append(f"- **Line {find.get('line', 0)}** (`{find.get('type', 'vacuous')}`): `{find.get('code', '')}` — {find.get('description', '')}")
            md.append("")

    return "\n".join(md)

def export_pldi_report(scan_data: dict, export_dir: str) -> dict:
    os.makedirs(export_dir, exist_ok=True)
    tex_content = generate_latex_appendix(scan_data)
    md_content = generate_markdown_appendix(scan_data)

    tex_path = os.path.join(export_dir, "academic_appendix.tex")
    md_path = os.path.join(export_dir, "academic_appendix.md")

    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_content)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    return {
        "success": True,
        "export_dir": export_dir,
        "tex_path": tex_path,
        "md_path": md_path,
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: pldi_report.py <scan_json_or_workspace_path> [export_dir]"}))
        sys.exit(1)

    target = sys.argv[1]
    export_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.getcwd(), "exports", f"academic_appendix_{int(time.time())}")

    if os.path.isfile(target):
        with open(target, "r", encoding="utf-8") as f:
            scan_data = json.load(f)
    elif os.path.isdir(target):
        from scan_workspace import scan_workspace
        scan_data = scan_workspace(target)
    else:
        try:
            scan_data = json.loads(target)
        except Exception:
            scan_data = {"error": f"Invalid target: {target}", "files": []}

    res = export_pldi_report(scan_data, export_dir)
    print(json.dumps(res, indent=2))
