const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.gemini',
  '.vscode',
  '.turbo',
]);

const SECRET_RULES = [
  {
    id: 'SEC-OPENAI',
    severity: 'high',
    title: 'Hardcoded OpenAI API Key',
    regex: /sk-[a-zA-Z0-9_-]{20,}/g,
    recommendation: 'Move the OpenAI API key to an environment variable and rotate it immediately.',
  },
  {
    id: 'SEC-GITHUB',
    severity: 'high',
    title: 'Hardcoded GitHub Personal Access Token',
    regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/g,
    recommendation: 'Revoke the exposed GitHub token and store it in GitHub Secrets or secure vault.',
  },
  {
    id: 'SEC-AWS',
    severity: 'critical',
    title: 'Hardcoded AWS Access Key ID',
    regex: /AKIA[0-9A-Z]{16}/g,
    recommendation: 'Revoke AWS credentials in IAM and use AWS IAM Roles or AWS Secrets Manager.',
  },
  {
    id: 'SEC-JWT',
    severity: 'medium',
    title: 'Hardcoded JSON Web Token (JWT)',
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    recommendation: 'Do not commit active JWTs. Use short-lived dynamic tokens generated at runtime.',
  },
  {
    id: 'SEC-RSA-KEY',
    severity: 'critical',
    title: 'Hardcoded Private Key Block',
    regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
    recommendation: 'Remove private keys from source code immediately. Rotate the key pair.',
  },
  {
    id: 'SEC-GENERIC-SECRET',
    severity: 'medium',
    title: 'Hardcoded Password / Secret Assignment',
    regex: /(?:password|secret|passwd|api_key|auth_token)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
    recommendation: 'Avoid hardcoded passwords or secrets in application source code.',
  },
];

const RISKY_PATTERNS = [
  {
    id: 'PAT-EVAL',
    severity: 'high',
    title: 'Use of eval() Dynamic Code Execution',
    regex: /\beval\s*\(/g,
    recommendation: 'Avoid eval() as it can lead to arbitrary code execution vulnerabilities.',
  },
  {
    id: 'PAT-NEW-FUNC',
    severity: 'high',
    title: 'Use of new Function() Code Execution',
    regex: /new\s+Function\s*\(/g,
    recommendation: 'Avoid new Function() constructors that evaluate untrusted input strings.',
  },
  {
    id: 'PAT-EXEC',
    severity: 'critical',
    title: 'Use of child_process.exec / execSync',
    regex: /child_process\.(?:exec|execSync)\s*\(/g,
    recommendation: 'Use execFile or spawn with explicit arguments to prevent Command Injection.',
  },
  {
    id: 'PAT-SHELL-TRUE',
    severity: 'critical',
    title: 'Python Subprocess with shell=True',
    regex: /shell\s*=\s*True/g,
    recommendation: 'Pass arguments as a list and set shell=False to prevent shell injection.',
  },
  {
    id: 'PAT-PICKLE',
    severity: 'critical',
    title: 'Insecure Deserialization via pickle.loads',
    regex: /pickle\.loads?\s*\(/g,
    recommendation: 'Never unpickle untrusted data. Use safe serialization formats like JSON or Protocol Buffers.',
  },
];

class SecurityAuditManager {
  constructor() {
    this.advisories = this.loadAdvisories();
  }

  loadAdvisories() {
    try {
      const advPath = path.join(__dirname, '../security/advisories/sample-advisories.json');
      if (fs.existsSync(advPath)) {
        return JSON.parse(fs.readFileSync(advPath, 'utf8'));
      }
    } catch (e) {}
    return { npm: {}, pypi: {} };
  }

  scanFiles(dirPath, maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
    let results = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.env')) {
          continue;
        }
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(this.scanFiles(fullPath, maxDepth, currentDepth + 1));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch (e) {}
    return results;
  }

  scanSecretsInContent(filePath, content) {
    const findings = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      for (const rule of SECRET_RULES) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(line)) !== null) {
          findings.push({
            id: `${rule.id}-${lineNum}`,
            type: 'secret',
            severity: rule.severity,
            title: rule.title,
            file: filePath,
            line: lineNum,
            column: match.index + 1,
            excerpt: line.trim().slice(0, 120),
            recommendation: rule.recommendation,
          });
        }
      }
    });

    return findings;
  }

  scanRiskyPatternsInContent(filePath, content) {
    const findings = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      for (const rule of RISKY_PATTERNS) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(line)) !== null) {
          findings.push({
            id: `${rule.id}-${lineNum}`,
            type: 'pattern',
            severity: rule.severity,
            title: rule.title,
            file: filePath,
            line: lineNum,
            column: match.index + 1,
            excerpt: line.trim().slice(0, 120),
            recommendation: rule.recommendation,
          });
        }
      }
    });

    return findings;
  }

  scanConfigFiles(workspacePath) {
    const findings = [];
    const sensitiveFiles = [
      { name: '.env', title: 'Committed .env configuration file', severity: 'medium', rec: 'Ensure .env is listed in .gitignore and never committed.' },
      { name: '.npmrc', title: 'NPM config file with possible authToken', severity: 'medium', rec: 'Ensure private NPM tokens are kept in environment variables.' },
      { name: '.pypirc', title: 'PyPI config with credentials', severity: 'high', rec: 'Do not commit .pypirc credentials.' },
    ];

    for (const item of sensitiveFiles) {
      const p = path.join(workspacePath, item.name);
      if (fs.existsSync(p)) {
        findings.push({
          id: `CONF-${item.name.replace('.', '')}`,
          type: 'config',
          severity: item.severity,
          title: item.title,
          file: p,
          line: 1,
          column: 1,
          excerpt: `Found configuration file: ${item.name}`,
          recommendation: item.rec,
        });
      }
    }

    return findings;
  }

  scanDependencies(workspacePath) {
    const findings = [];
    const pkgPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dep, version] of Object.entries(allDeps)) {
          const advisories = this.advisories.npm[dep];
          if (advisories) {
            advisories.forEach((adv, idx) => {
              findings.push({
                id: `DEP-NPM-${dep}-${idx}`,
                type: 'dependency',
                severity: adv.severity,
                title: `${adv.title} (${dep}@${version})`,
                file: pkgPath,
                line: 1,
                column: 1,
                excerpt: `"${dep}": "${version}"`,
                recommendation: `${adv.recommendation} [${adv.cve || 'Advisory'}]`,
              });
            });
          }
        }
      } catch (e) {}
    }

    const reqPath = path.join(workspacePath, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        const reqContent = fs.readFileSync(reqPath, 'utf8');
        reqContent.split('\n').forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const match = trimmed.match(/^([a-zA-Z0-9_\-]+)(?:==|<=|>=|<|>)?(.*)/);
          if (match) {
            const dep = match[1].toLowerCase();
            const advisories = this.advisories.pypi[dep];
            if (advisories) {
              advisories.forEach((adv, aIdx) => {
                findings.push({
                  id: `DEP-PY-${dep}-${aIdx}`,
                  type: 'dependency',
                  severity: adv.severity,
                  title: `${adv.title} (${dep})`,
                  file: reqPath,
                  line: idx + 1,
                  column: 1,
                  excerpt: trimmed,
                  recommendation: `${adv.recommendation} [${adv.cve || 'Advisory'}]`,
                });
              });
            }
          }
        });
      } catch (e) {}
    }

    return findings;
  }

  scanWorkspace(workspacePath) {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return {
        success: false,
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
        findings: [],
        generatedAt: Date.now(),
      };
    }

    const allFindings = [];

    // 1. Scan files for secrets and risky patterns
    const files = this.scanFiles(workspacePath);
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf8');
        allFindings.push(...this.scanSecretsInContent(f, content));
        allFindings.push(...this.scanRiskyPatternsInContent(f, content));
      } catch (e) {}
    }

    // 2. Scan config files
    allFindings.push(...this.scanConfigFiles(workspacePath));

    // 3. Scan dependencies
    allFindings.push(...this.scanDependencies(workspacePath));

    // Order deterministically by severity then file:line
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    allFindings.sort((a, b) => {
      const wA = severityWeight[a.severity] || 0;
      const wB = severityWeight[b.severity] || 0;
      if (wA !== wB) return wB - wA;
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return (a.line || 0) - (b.line || 0);
    });

    const summary = {
      critical: allFindings.filter((f) => f.severity === 'critical').length,
      high: allFindings.filter((f) => f.severity === 'high').length,
      medium: allFindings.filter((f) => f.severity === 'medium').length,
      low: allFindings.filter((f) => f.severity === 'low').length,
      info: allFindings.filter((f) => f.severity === 'info').length,
      total: allFindings.length,
    };

    return {
      success: true,
      workspacePath,
      summary,
      findings: allFindings,
      generatedAt: Date.now(),
    };
  }

  exportReport(report, format = 'json') {
    if (format === 'markdown') {
      const dateStr = new Date(report.generatedAt || Date.now()).toUTCString();
      let md = `# Echo Nullity Security & Dependency Audit Report\n\n`;
      md += `**Generated:** ${dateStr}\n\n`;
      md += `## Summary\n\n`;
      md += `- **Critical:** ${report.summary?.critical || 0}\n`;
      md += `- **High:** ${report.summary?.high || 0}\n`;
      md += `- **Medium:** ${report.summary?.medium || 0}\n`;
      md += `- **Low:** ${report.summary?.low || 0}\n`;
      md += `- **Total Findings:** ${report.summary?.total || 0}\n\n`;
      md += `## Findings\n\n`;

      (report.findings || []).forEach((f, idx) => {
        md += `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}\n\n`;
        md += `- **ID:** \`${f.id}\`\n`;
        md += `- **Type:** \`${f.type}\`\n`;
        md += `- **File:** \`${f.file}:${f.line}\`\n`;
        if (f.excerpt) md += `- **Excerpt:** \`${f.excerpt}\`\n`;
        md += `- **Recommendation:** ${f.recommendation}\n\n`;
      });

      return {
        success: true,
        format: 'markdown',
        content: md,
      };
    }

    return {
      success: true,
      format: 'json',
      content: JSON.stringify(report, null, 2),
    };
  }
}

const securityAuditManager = new SecurityAuditManager();

module.exports = {
  SecurityAuditManager,
  securityAuditManager,
};
