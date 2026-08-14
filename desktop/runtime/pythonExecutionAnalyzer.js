function analyzePythonExecution(code = '', stdout = '', stderr = '') {
  const codeLines = code.split('\n');
  const variables = {};
  const safetyWarnings = [];

  // 1. Variable extraction via regex
  for (const line of codeLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (match) {
      const varName = match[1];
      const varVal = match[2].trim();
      if (!['if', 'elif', 'while', 'for', 'return', 'def', 'class'].includes(varName)) {
        variables[varName] = varVal;
      }
    }
  }

  // 2. Dangerous operations detection
  const dangerousPatterns = [
    { pattern: /\bopen\s*\(/, warning: 'Dangerous file I/O operation detected (open())' },
    { pattern: /\bos\.remove\b/, warning: 'Dangerous filesystem deletion detected (os.remove)' },
    { pattern: /\bsubprocess\b/, warning: 'Dangerous system process execution detected (subprocess)' },
    { pattern: /\beval\s*\(/, warning: 'Dangerous dynamic evaluation detected (eval())' },
    { pattern: /\bexec\s*\(/, warning: 'Dangerous dynamic execution detected (exec())' },
    { pattern: /\bshutil\b/, warning: 'Dangerous file system modification detected (shutil)' },
  ];

  for (const item of dangerousPatterns) {
    if (item.pattern.test(code)) {
      safetyWarnings.push(item.warning);
    }
  }

  // 3. Complexity estimation
  let complexity = 'O(1)';
  const forLoops = (code.match(/\bfor\b/g) || []).length;
  const whileLoops = (code.match(/\bwhile\b/g) || []).length;
  const totalLoops = forLoops + whileLoops;

  if (totalLoops >= 2) {
    complexity = 'O(n²) [Nested loops detected]';
  } else if (totalLoops === 1) {
    complexity = 'O(n) [Single loop detected]';
  } else {
    complexity = 'O(1) [Constant time / No loops]';
  }

  // Infinite loop suspicion
  if (/\bwhile\s+(True|1)\b/.test(code) && !/\bbreak\b/.test(code)) {
    safetyWarnings.push('Infinite loop warning: while True loop detected without explicit break statement.');
  }

  // 4. Status and Error Analysis
  const hasStderr = stderr && stderr.trim().length > 0;

  if (!hasStderr) {
    return {
      status: 'success',
      summary: 'Python script executed successfully with zero runtime or syntax errors.',
      variables,
      complexity,
      safetyWarnings,
      beginnerExplanation: 'Your Python code ran completely fine without any errors.',
    };
  }

  const errStr = stderr.trim();

  // SyntaxError check
  if (errStr.includes('SyntaxError') || errStr.includes('IndentationError')) {
    return {
      status: 'syntax_error',
      summary: 'Syntax Error detected: Python could not parse your code structure.',
      variables,
      error: errStr.split('\n').pop() || errStr,
      rootCause: 'Invalid code syntax or improper indentation structure.',
      suggestedFix: 'Check for missing colons (:), unclosed parentheses, or incorrect indentation.',
      complexity,
      safetyWarnings,
      beginnerExplanation: 'Python could not understand the grammar of your code. Make sure punctuation and indentation are correct.',
    };
  }

  // ZeroDivisionError
  if (errStr.includes('ZeroDivisionError')) {
    return {
      status: 'runtime_error',
      summary: 'Runtime Error: ZeroDivisionError encountered.',
      variables,
      error: 'ZeroDivisionError: division by zero',
      rootCause: 'An arithmetic division or modulo operation was attempted with a denominator of zero.',
      suggestedFix: 'Validate that the denominator is non-zero before performing division (e.g. if denominator != 0:).',
      complexity,
      safetyWarnings,
      beginnerExplanation: 'You tried to divide a number by zero, which is mathematically undefined and not allowed in Python.',
    };
  }

  // NameError
  if (errStr.includes('NameError')) {
    const varMatch = errStr.match(/name '([^']+)' is not defined/);
    const missingVar = varMatch ? varMatch[1] : 'variable';
    return {
      status: 'runtime_error',
      summary: `Runtime Error: NameError encountered ('${missingVar}' is not defined).`,
      variables,
      error: `NameError: name '${missingVar}' is not defined`,
      rootCause: `Referenced variable '${missingVar}' was used before being assigned a value in the current scope.`,
      suggestedFix: `Define '${missingVar}' before using it (e.g. ${missingVar} = ...).`,
      complexity,
      safetyWarnings,
      beginnerExplanation: `Python does not know what '${missingVar}' is because it was not created or assigned a value beforehand.`,
    };
  }

  // TypeError
  if (errStr.includes('TypeError')) {
    return {
      status: 'runtime_error',
      summary: 'Runtime Error: TypeError encountered.',
      variables,
      error: errStr.split('\n').pop() || 'TypeError',
      rootCause: 'An operation or function was applied to an incompatible data type.',
      suggestedFix: 'Convert operands to compatible types using explicit casting (e.g. str(), int(), float()).',
      complexity,
      safetyWarnings,
      beginnerExplanation: 'You tried to combine or operate on two incompatible data types (like adding text to a number).',
    };
  }

  // IndexError
  if (errStr.includes('IndexError')) {
    return {
      status: 'runtime_error',
      summary: 'Runtime Error: IndexError encountered.',
      variables,
      error: 'IndexError: list index out of range',
      rootCause: 'Attempted to access a sequence element using an index outside valid bounds.',
      suggestedFix: 'Check sequence length before indexing (e.g. if index < len(sequence):).',
      complexity,
      safetyWarnings,
      beginnerExplanation: 'You tried to access an item position in a list that does not exist.',
    };
  }

  // KeyError
  if (errStr.includes('KeyError')) {
    return {
      status: 'runtime_error',
      summary: 'Runtime Error: KeyError encountered.',
      variables,
      error: errStr.split('\n').pop() || 'KeyError',
      rootCause: 'Attempted to access a dictionary key that does not exist.',
      suggestedFix: 'Check key existence using `in` operator or dict.get(key, default).',
      complexity,
      safetyWarnings,
      beginnerExplanation: 'You looked for a key in a dictionary that was not present.',
    };
  }

  // General Fallback Runtime Error
  return {
    status: 'runtime_error',
    summary: 'Runtime Error encountered during script execution.',
    variables,
    error: errStr.split('\n').pop() || errStr,
    rootCause: 'Python raised an exception during runtime execution.',
    suggestedFix: 'Inspect the stack trace in stderr to identify the failing line.',
    complexity,
    safetyWarnings,
    beginnerExplanation: 'An error occurred while Python was executing your script.',
  };
}

module.exports = {
  analyzePythonExecution,
};
