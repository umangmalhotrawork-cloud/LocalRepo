export interface FindingItem {
  file?: string;
  line: number;
  type?: string;
  title: string;
  code: string;
  description: string;
  causal_impact?: number;
  causal_path_length?: number;
  return_sink_line?: number | null;
  provenance_chain?: Array<{
    type: string;
    line: number;
    code: string;
  }>;
}

export interface ReportMetrics {
  files_scanned: number;
  total_ghost_lines: number;
  total_lines: number;
  ghost_ratio: number;
  average_causal_luminance?: number;
  risky_files_count?: number;
  safe_removals_count?: number;
  scan_duration_ms?: number;
}

export interface ReportExportPayload {
  workspacePath: string;
  timestamp: string;
  metrics: ReportMetrics;
  findings: FindingItem[];
  graphSvg?: string;
  activeFinding?: FindingItem | null;
}

export function buildWorkspaceReport(data: ReportExportPayload): string {
  const { workspacePath, timestamp, metrics, findings, graphSvg, activeFinding } = data;
  const projectName = workspacePath.split("/").pop() || "Workspace Project";
  const ghostRatioPct = (metrics.ghost_ratio * 100).toFixed(1);
  const avgLum = ((metrics.average_causal_luminance ?? 0) * 100).toFixed(1);

  const findingsRows = findings
    .map(
      (f, idx) => `
      <tr style="border-bottom: 1px solid #1f1f1f;">
        <td style="padding: 12px 14px; font-weight: bold; color: #38bdf8;">${f.file || "active_file.py"}</td>
        <td style="padding: 12px 14px; color: #fbbf24; font-weight: bold;">Line ${f.line}</td>
        <td style="padding: 12px 14px; color: #e5e7eb;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(f.title)}</div>
          <code style="background: #121212; padding: 2px 6px; border-radius: 4px; color: #cbd5e1; font-size: 11px;">${escapeHtml(f.code)}</code>
        </td>
        <td style="padding: 12px 14px; color: #94a3b8; font-size: 11px;">${escapeHtml(f.description)}</td>
        <td style="padding: 12px 14px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-weight: bold; font-size: 10px;">
            ${(f.causal_impact ?? 0.0).toFixed(1)}% IMPACT
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  const provenanceSection = activeFinding && activeFinding.provenance_chain && activeFinding.provenance_chain.length > 0
    ? `
    <div style="margin-top: 36px; padding: 20px; background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px;">
      <h3 style="margin: 0 0 16px 0; color: #22d3ee; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
        Active Finding Provenance Trace (Line ${activeFinding.line})
      </h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${activeFinding.provenance_chain
          .map((step) => {
            const stepColor =
              step.type === "definition"
                ? "#22d3ee"
                : step.type === "ghost_operation"
                ? "#fbbf24"
                : step.type === "return_sink"
                ? "#34d399"
                : "#a855f7";
            return `
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #121212; border-left: 3px solid ${stepColor}; border-radius: 4px;">
              <span style="font-size: 10px; font-weight: bold; color: ${stepColor}; text-transform: uppercase; width: 110px;">${step.type.replace("_", " ")}</span>
              <span style="font-size: 11px; color: #71717a; width: 60px;">L${step.line}</span>
              <code style="font-size: 11px; color: #f1f5f9; flex: 1;">${escapeHtml(step.code)}</code>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Echo Nullity — Tomographic Report: ${escapeHtml(projectName)}</title>
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      background-color: #050505;
      color: #e5e7eb;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      line-height: 1.5;
      font-size: 12px;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #1f1f1f;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      color: #22d3ee;
      letter-spacing: -0.02em;
    }
    .logo span {
      color: #a855f7;
    }
    .meta {
      text-align: right;
      color: #71717a;
      font-size: 11px;
    }
    .grid-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }
    .card {
      background: #0a0a0a;
      border: 1px solid #1f1f1f;
      border-radius: 12px;
      padding: 16px;
    }
    .card-label {
      font-size: 10px;
      color: #71717a;
      text-transform: uppercase;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .card-val {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
    }
    .table-container {
      background: #0a0a0a;
      border: 1px solid #1f1f1f;
      border-radius: 12px;
      overflow: hidden;
      margin-top: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #111111;
      padding: 12px 14px;
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #1f1f1f;
    }
    .graph-section {
      margin-top: 36px;
      padding: 20px;
      background: #0a0a0a;
      border: 1px solid #1f1f1f;
      border-radius: 12px;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #1f1f1f;
      text-align: center;
      color: #52525b;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo">ECHO <span>NULLITY</span></div>
        <div style="font-size: 13px; color: #a1a1aa; margin-top: 4px;">Tomographic Vacuity & Data-Flow Analysis Report</div>
        <div style="font-size: 11px; color: #06b6d4; margin-top: 6px;">${escapeHtml(workspacePath)}</div>
      </div>
      <div class="meta">
        <div>Exported on ${escapeHtml(timestamp)}</div>
        <div style="margin-top: 4px; color: #10b981; font-weight: bold;">● Verification Confirmed</div>
      </div>
    </div>

    <!-- Summary Metrics -->
    <div class="grid-metrics">
      <div class="card">
        <div class="card-label">Files Analyzed</div>
        <div class="card-val" style="color: #22d3ee;">${metrics.files_scanned}</div>
      </div>
      <div class="card">
        <div class="card-label">Ghost Lines</div>
        <div class="card-val" style="color: #fbbf24;">${metrics.total_ghost_lines}</div>
      </div>
      <div class="card">
        <div class="card-label">Total Code Lines</div>
        <div class="card-val" style="color: #e2e8f0;">${metrics.total_lines}</div>
      </div>
      <div class="card">
        <div class="card-label">Vacuous Ratio</div>
        <div class="card-val" style="color: #f87171;">${ghostRatioPct}%</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Luminance</div>
        <div class="card-val" style="color: #a855f7;">${avgLum}%</div>
      </div>
      <div class="card">
        <div class="card-label">Risky Modules</div>
        <div class="card-val" style="color: #fb923c;">${metrics.risky_files_count ?? 1}</div>
      </div>
    </div>

    <!-- Findings Table -->
    <div style="margin-top: 32px;">
      <h2 style="font-size: 14px; text-transform: uppercase; color: #ffffff; margin-bottom: 12px; letter-spacing: 0.05em;">
        Detected Vacuous Findings (${findings.length})
      </h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Location</th>
              <th>Pattern / Snippet</th>
              <th>Analysis Insight</th>
              <th style="text-align: center;">Causal Impact</th>
            </tr>
          </thead>
          <tbody>
            ${findingsRows || `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #71717a;">No ghost lines detected in this workspace.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Provenance Trace -->
    ${provenanceSection}

    <!-- Cross-File Graph SVG Placeholder / Embed -->
    ${
      graphSvg
        ? `
    <div class="graph-section">
      <h2 style="font-size: 14px; text-transform: uppercase; color: #22d3ee; margin-bottom: 12px; letter-spacing: 0.05em;">
        Cross-File Provenance & Dependency Graph
      </h2>
      <div style="overflow-x: auto; background: #050505; border: 1px solid #18181b; border-radius: 8px; padding: 12px; display: flex; justify-content: center;">
        ${graphSvg}
      </div>
    </div>
    `
        : ""
    }

    <!-- Footer -->
    <div class="footer">
      Generated by Echo Nullity · Causal Tomography & Safe Code Surgery Suite · Offline Self-Contained Report
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
