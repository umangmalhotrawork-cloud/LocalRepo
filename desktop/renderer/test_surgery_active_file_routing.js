#!/usr/bin/env node

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ideAppPath = path.join(__dirname, 'IDEApp.tsx');
const source = fs.readFileSync(ideAppPath, 'utf8');

function handlerSource(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notStrictEqual(start, -1, `Could not find ${startMarker}`);
  assert.notStrictEqual(end, -1, `Could not find ${endMarker}`);
  return source.slice(start, end);
}

const recentWorkspaceHandler = handlerSource(
  'const handleOpenRecentWorkspace',
  '// Open File Handler',
);
assert.ok(recentWorkspaceHandler.includes('setWorkspaceSummary(scanRes)'));
assert.ok(recentWorkspaceHandler.includes('setWorkspaceReport(scanRes)'));
assert.ok(
  !recentWorkspaceHandler.includes('handleOpenWorkspaceFile('),
  'A delayed workspace scan must update findings without changing the active file.',
);

const surgeryHandler = handlerSource(
  'const handleApplySurgery',
  'const handleUndoSurgery',
);
assert.ok(surgeryHandler.includes('const targetTab = openTabs.find((tab) => tab.path === filePath)'));
assert.ok(surgeryHandler.includes('activeTab.path !== filePath'));
assert.ok(surgeryHandler.includes('window.electronAPI.applySafeRemove(filePath, transformedSource)'));
assert.ok(surgeryHandler.includes('t.path === filePath'));
assert.ok(
  surgeryHandler.includes(
    'runAnalysis({ ...targetTab, content: transformedContent, savedContent: transformedContent, isDirty: false })',
  ),
  'Surgery must re-analyze the same preview target using its transformed content.',
);

const previewSource = fs.readFileSync(path.join(__dirname, 'components', 'SurgeryDiffPreview.tsx'), 'utf8');
assert.ok(previewSource.includes('filePath,'));
assert.ok(previewSource.includes('transformedSource,'));

const projectRoot = path.resolve(__dirname, '..', '..');
const cartHelper = path.join(projectRoot, 'demo-workspaces', 'ai_cart_project', 'src', 'cart_helper.js');
const analyzer = path.join(projectRoot, 'desktop', 'engine', 'js_analyzer.js');
const originalSource = fs.readFileSync(cartHelper, 'utf8');
const preview = JSON.parse(childProcess.execFileSync(
  process.execPath,
  [analyzer, cartHelper, '--mode', 'rewrite'],
  { encoding: 'utf8' },
));

assert.strictEqual(preview.changed_lines.length, 7);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-nullity-surgery-'));
try {
  const target = path.join(tempDir, 'cart_helper.js');
  const backup = `${target}.bak`;
  fs.writeFileSync(target, originalSource, 'utf8');

  // This is the write contract used by the renderer's applySafeRemove IPC call.
  fs.copyFileSync(target, backup);
  fs.writeFileSync(target, preview.transformed_source, 'utf8');

  childProcess.execFileSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  assert.strictEqual(fs.readFileSync(backup, 'utf8'), originalSource);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), preview.transformed_source);
  assert.ok(!fs.readFileSync(target, 'utf8').includes('subtotal = subtotal * 1;'));
  assert.ok(!fs.readFileSync(target, 'utf8').includes('isTaxable = isTaxable && true;'));

  const postApplyScan = JSON.parse(childProcess.execFileSync(
    process.execPath,
    [analyzer, target, '--mode', 'rewrite'],
    { encoding: 'utf8' },
  ));
  assert.strictEqual(postApplyScan.changed_lines.length, 0);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('Safe Surgery cart_helper apply and active-file routing regression test passed.');
