/**
 * Echo Nullity — Live Web Preview Workspace Engine (Milestone 26)
 * 
 * Bundles and injects HTML, CSS, and JS from open tabs or workspace files
 * into a sandboxed preview payload for zero-latency client-side rendering.
 */

function shouldShowPreview(path = '') {
  if (!path || typeof path !== 'string') return false;
  const ext = path.toLowerCase().split('.').pop();
  return ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx'].includes(ext);
}

function buildPreviewHtml(params = {}) {
  const {
    htmlContent = '',
    cssContent = '',
    jsContent = '',
    openTabs = [],
  } = params;

  // Find HTML content from active tab or open HTML tab
  let finalHtml = htmlContent;

  if (!finalHtml && Array.isArray(openTabs)) {
    const htmlTab = openTabs.find(t => t && t.path && (t.path.endsWith('.html') || t.path.endsWith('.htm')));
    if (htmlTab) {
      finalHtml = htmlTab.content || '';
    }
  }

  // Fallback default HTML wrapper if no HTML provided
  if (!finalHtml.trim()) {
    finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #0d0d0d; color: #e4e4e7; }
    h1 { color: #38bdf8; }
  </style>
</head>
<body>
  <h1>Live Web Preview</h1>
  <p>Editing active web assets (.html, .css, .js)...</p>
</body>
</html>`;
  }

  // Gather all CSS from open tabs if present
  let injectedCss = cssContent;
  if (Array.isArray(openTabs)) {
    const cssTabs = openTabs.filter(t => t && t.path && t.path.endsWith('.css'));
    const cssText = cssTabs.map(t => t.content).filter(Boolean).join('\n');
    if (cssText) {
      injectedCss = injectedCss ? `${injectedCss}\n${cssText}` : cssText;
    }
  }

  // Gather all JS from open tabs if present
  let injectedJs = jsContent;
  if (Array.isArray(openTabs)) {
    const jsTabs = openTabs.filter(t => t && t.path && (t.path.endsWith('.js') || t.path.endsWith('.jsx')));
    const jsText = jsTabs.map(t => t.content).filter(Boolean).join('\n');
    if (jsText) {
      injectedJs = injectedJs ? `${injectedJs}\n${jsText}` : jsText;
    }
  }

  // Inject CSS style tag into head
  if (injectedCss) {
    const styleTag = `<style>\n${injectedCss}\n</style>`;
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${styleTag}\n</head>`);
    } else {
      finalHtml = `${styleTag}\n${finalHtml}`;
    }
  }

  // Inject JS script tag into body
  if (injectedJs) {
    const scriptTag = `<script>\ntry {\n${injectedJs}\n} catch(err) { console.error('[PREVIEW-ERR]', err); }\n</script>`;
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      finalHtml = `${finalHtml}\n${scriptTag}`;
    }
  }

  return finalHtml;
}

module.exports = {
  shouldShowPreview,
  buildPreviewHtml,
};
