const assert = require('assert');
const { shouldShowPreview, buildPreviewHtml } = require('./live_web_preview');

console.log('[TEST-LIVE-PREVIEW] Starting Milestone 26 Live Web Preview Engine Test Suite...');

function runTests() {
  // Test 1: shouldShowPreview
  assert.strictEqual(shouldShowPreview('index.html'), true);
  assert.strictEqual(shouldShowPreview('styles.css'), true);
  assert.strictEqual(shouldShowPreview('app.js'), true);
  assert.strictEqual(shouldShowPreview('script.py'), false);
  console.log('✓ Test 1 Passed: shouldShowPreview extension detection');

  // Test 2: buildPreviewHtml with direct HTML
  const html = '<html><head></head><body><h1>Hello</h1></body></html>';
  const res1 = buildPreviewHtml({ htmlContent: html });
  assert(res1.includes('<h1>Hello</h1>'));
  console.log('✓ Test 2 Passed: Direct HTML bundling');

  // Test 3: buildPreviewHtml with CSS & JS injection
  const css = 'body { color: red; }';
  const js = 'console.log("test");';
  const res2 = buildPreviewHtml({ htmlContent: html, cssContent: css, jsContent: js });
  assert(res2.includes('body { color: red; }'));
  assert(res2.includes('console.log("test");'));
  console.log('✓ Test 3 Passed: CSS and JS tag injection into preview HTML');

  // Test 4: openTabs fallback
  const openTabs = [
    { path: 'style.css', content: '.card { padding: 10px; }' },
    { path: 'index.html', content: '<div>Tab HTML</div>' }
  ];
  const res3 = buildPreviewHtml({ openTabs });
  assert(res3.includes('<div>Tab HTML</div>'));
  assert(res3.includes('.card { padding: 10px; }'));
  console.log('✓ Test 4 Passed: Open tabs resolution fallback');

  console.log('\nALL 4 MILESTONE 26 LIVE WEB PREVIEW ENGINE TESTS PASSED PERFECTLY!');
}

runTests();
