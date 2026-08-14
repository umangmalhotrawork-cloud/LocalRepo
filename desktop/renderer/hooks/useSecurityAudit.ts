"use client";

import { useState, useCallback, useEffect } from "react";

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";

export type SecurityFinding = {
  id: string;
  type: "secret" | "pattern" | "dependency" | "config";
  severity: SecuritySeverity;
  title: string;
  file: string;
  line: number;
  column?: number;
  excerpt?: string;
  recommendation: string;
};

export type SecuritySummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
};

export type SecurityReport = {
  success: boolean;
  workspacePath: string;
  summary: SecuritySummary;
  findings: SecurityFinding[];
  generatedAt: number;
};

export function useSecurityAudit(workspacePath: string) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>("");

  const runScan = useCallback(async (targetPath?: string) => {
    const ws = targetPath || workspacePath;
    if (!ws) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.security?.scan) {
        const res = await (window as any).electronAPI.security.scan(ws);
        if (res && res.findings) {
          setReport(res);
          setSelectedFinding(res.findings[0] || null);
          return res;
        }
      }
    } catch (err) {
      console.error("[SECURITY-AUDIT] Scan error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  const exportJson = useCallback(async () => {
    if (!report) return;
    if (typeof window !== "undefined" && (window as any).electronAPI?.security?.export) {
      try {
        return await (window as any).electronAPI.security.export({ report, format: "json" });
      } catch (e) {}
    }

    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-security-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  const exportMarkdown = useCallback(async () => {
    if (!report) return;
    if (typeof window !== "undefined" && (window as any).electronAPI?.security?.export) {
      try {
        return await (window as any).electronAPI.security.export({ report, format: "markdown" });
      } catch (e) {}
    }

    let md = `# Echo Nullity Security Audit Report\n\n`;
    md += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n`;
    md += `## Summary\n\n`;
    md += `- Critical: ${report.summary.critical}\n`;
    md += `- High: ${report.summary.high}\n`;
    md += `- Medium: ${report.summary.medium}\n`;
    md += `- Low: ${report.summary.low}\n`;
    md += `- Total: ${report.summary.total}\n\n`;
    md += `## Findings\n\n`;
    report.findings.forEach((f, idx) => {
      md += `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}\n\n`;
      md += `- **File:** \`${f.file}:${f.line}\`\n`;
      if (f.excerpt) md += `- **Excerpt:** \`${f.excerpt}\`\n`;
      md += `- **Recommendation:** ${f.recommendation}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-security-audit-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  useEffect(() => {
    if (workspacePath) {
      runScan(workspacePath);
    }
  }, [workspacePath, runScan]);

  const filteredFindings = (report?.findings || []).filter((f) => {
    const matchesSev = !filterSeverity || f.severity === filterSeverity;
    const matchesText =
      !filterQuery ||
      f.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.file.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (f.excerpt && f.excerpt.toLowerCase().includes(filterQuery.toLowerCase()));
    return matchesSev && matchesText;
  });

  return {
    report,
    findings: report?.findings || [],
    filteredFindings,
    summary: report?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    loading,
    selectedFinding,
    setSelectedFinding,
    filterSeverity,
    setFilterSeverity,
    filterQuery,
    setFilterQuery,
    runScan,
    exportJson,
    exportMarkdown,
  };
}
