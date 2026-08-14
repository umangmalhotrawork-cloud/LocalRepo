/**
 * Echo Nullity — Time-Travel Debugger Engine (Milestone 28)
 */

function simulateTracePython(code = '') {
  const lines = code.split('\n');
  const steps = [];
  const env = {};

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    if (trimmed.includes('=')) {
      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (match) {
        env[match[1]] = match[2].trim();
      }
    }

    steps.push({
      line: index + 1,
      code: trimmed,
      variables: { ...env },
    });
  });

  return steps;
}

module.exports = {
  simulateTracePython,
};
