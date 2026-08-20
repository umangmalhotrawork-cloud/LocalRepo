const fs = require('fs');
const path = require('path');
let dialog = null;
let app = null;
try {
  const electron = require('electron');
  dialog = electron.dialog;
  app = electron.app;
} catch (e) {}

async function exportWorkspaceReport(payload, browserWindow) {
  try {
    let targetBaseDir = payload.targetDirectory;

    if (!targetBaseDir) {
      targetBaseDir = path.join(payload.workspacePath || process.cwd(), 'exports');
    }

    // Format timestamp: YYYY-MM-DD-HH-mm
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const folderTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const folderName = `EchoNullity-Report-${folderTimestamp}`;

    const reportDirPath = path.join(targetBaseDir, folderName);
    const assetsDirPath = path.join(reportDirPath, 'assets');

    // Create report and assets directories
    fs.mkdirSync(reportDirPath, { recursive: true });
    fs.mkdirSync(assetsDirPath, { recursive: true });

    // 1. Write report.html
    const htmlContent = payload.htmlContent || '<html><body>NEXUS Engineering Report</body></html>';
    fs.writeFileSync(path.join(reportDirPath, 'report.html'), htmlContent, 'utf-8');

    // 2. Write findings.json
    const findingsData = typeof payload.findingsJson === 'string'
      ? payload.findingsJson
      : JSON.stringify(payload.findingsJson || [], null, 2);
    fs.writeFileSync(path.join(reportDirPath, 'findings.json'), findingsData, 'utf-8');

    // 3. Write graph.svg
    const graphSvgData = payload.graphSvg || '<svg></svg>';
    fs.writeFileSync(path.join(reportDirPath, 'graph.svg'), graphSvgData, 'utf-8');

    console.log('[REPORT-EXPORT] Successfully exported workspace report to:', reportDirPath);
    return {
      success: true,
      path: reportDirPath,
      htmlPath: path.join(reportDirPath, 'report.html'),
    };
  } catch (err) {
    console.error('[REPORT-EXPORT] Error exporting report:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  exportWorkspaceReport,
};
