const fs = require('fs');
const path = require('path');
let ts = null;
try {
  ts = require('typescript');
} catch (e) {}

function analyzeJS(filePath, mode = 'analyze', sourceContent) {
  if (sourceContent === undefined && !fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}`, findings: [], causal_luminance: 1.0, ghost_lines: 0, total_lines: 0 };
  }

  const code = sourceContent === undefined ? fs.readFileSync(filePath, 'utf-8') : sourceContent;
  const lines = code.split('\n');
  const total_lines = lines.length;

  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.ts')
    ? ts.ScriptKind.TS
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind);
  const findings = [];
  const vacuousLineSet = new Set();

  function getLineCol(node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      line: start.line + 1,
      col: start.character + 1,
      end_line: end.line + 1,
      end_col: end.character + 1,
    };
  }

  function isNumericLiteral(node, val) {
    return ts.isNumericLiteral(node) && parseFloat(node.text) === val;
  }

  function isBooleanLiteral(node, val) {
    if (val === true) return node.kind === ts.SyntaxKind.TrueKeyword;
    if (val === false) return node.kind === ts.SyntaxKind.FalseKeyword;
    return false;
  }

  function checkExpression(expr, lineInfo) {
    if (!expr) return;

    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;

      // Check right-hand side or left-hand side for assignment expressions (e.g. subtotal = subtotal * 1)
      if (op === ts.SyntaxKind.EqualsToken) {
        if (ts.isIdentifier(expr.left) && ts.isIdentifier(expr.right) && expr.left.text === expr.right.text) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'self_assignment',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: `Vacuous self-assignment: ${expr.left.text} = ${expr.right.text}`,
            reasoning: 'Assigning a variable to itself has no observable side-effect.',
          });
          vacuousLineSet.add(lineInfo.line);
        } else {
          checkExpression(expr.right, lineInfo);
        }
        return;
      }

      // Arithmetic multiplication by 1
      if (op === ts.SyntaxKind.AsteriskToken || op === ts.SyntaxKind.AsteriskEqualsToken) {
        if (isNumericLiteral(expr.right, 1) || isNumericLiteral(expr.left, 1)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'identity_multiplication',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant multiplication by 1 (identity operation)',
            reasoning: 'Multiplying any value by 1 returns the value unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }

      // Arithmetic division by 1
      if (op === ts.SyntaxKind.SlashToken || op === ts.SyntaxKind.SlashEqualsToken) {
        if (isNumericLiteral(expr.right, 1)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'identity_division',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant division by 1 (identity operation)',
            reasoning: 'Dividing any value by 1 returns the value unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }

      // Arithmetic addition of 0
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.PlusEqualsToken) {
        if (isNumericLiteral(expr.right, 0) || isNumericLiteral(expr.left, 0)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'identity_addition',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant addition of 0 (identity operation)',
            reasoning: 'Adding 0 to any value leaves it unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }

      // Arithmetic subtraction of 0
      if (op === ts.SyntaxKind.MinusToken || op === ts.SyntaxKind.MinusEqualsToken) {
        if (isNumericLiteral(expr.right, 0)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'identity_subtraction',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant subtraction of 0 (identity operation)',
            reasoning: 'Subtracting 0 from any value leaves it unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }

      // Boolean AND with true
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.AmpersandAmpersandEqualsToken) {
        if (isBooleanLiteral(expr.right, true) || isBooleanLiteral(expr.left, true)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'boolean_identity_and',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant boolean AND with true',
            reasoning: 'AND-ing a boolean expression with true returns the expression unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }

      // Boolean OR with false
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.BarBarEqualsToken) {
        if (isBooleanLiteral(expr.right, false) || isBooleanLiteral(expr.left, false)) {
          findings.push({
            line: lineInfo.line,
            col: lineInfo.col,
            end_line: lineInfo.end_line,
            end_col: lineInfo.end_col,
            type: 'boolean_identity_or',
            code: lines[lineInfo.line - 1]?.trim() || '',
            description: 'Redundant boolean OR with false',
            reasoning: 'OR-ing a boolean expression with false returns the expression unchanged.',
          });
          vacuousLineSet.add(lineInfo.line);
        }
      }
    }
  }

  function visit(node) {
    if (ts.isExpressionStatement(node)) {
      const lineInfo = getLineCol(node);
      checkExpression(node.expression, lineInfo);
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      const lineInfo = getLineCol(node);
      checkExpression(node.initializer, lineInfo);
    } else if (ts.isEmptyStatement(node)) {
      const lineInfo = getLineCol(node);
      findings.push({
        line: lineInfo.line,
        col: lineInfo.col,
        end_line: lineInfo.end_line,
        end_col: lineInfo.end_col,
        type: 'empty_statement',
        code: ';',
        description: 'Empty statement (standalone semicolon)',
        reasoning: 'Empty statements execute no code and consume cycle overhead.',
      });
      vacuousLineSet.add(lineInfo.line);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const ghost_lines = vacuousLineSet.size;
  const ghost_ratio = total_lines > 0 ? ghost_lines / total_lines : 0;
  const causal_luminance = Math.max(0.0, Math.min(1.0, 1.0 - ghost_ratio));

  if (mode === 'rewrite') {
    const remainingLines = lines.filter((_, idx) => !vacuousLineSet.has(idx + 1));
    return {
      transformed_source: remainingLines.join('\n'),
      changed_lines: Array.from(vacuousLineSet),
      findings,
    };
  }

  return {
    file_path: filePath,
    findings,
    causal_luminance: parseFloat(causal_luminance.toFixed(4)),
    ghost_lines,
    total_lines,
    ghost_ratio: parseFloat(ghost_ratio.toFixed(4)),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const usesStdin = args.includes('--stdin');
  const filePath = usesStdin ? args[args.indexOf('--path') + 1] : args[0];
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'analyze';

  if (!filePath) {
    console.log(JSON.stringify({ error: 'No file path provided', findings: [] }));
    process.exit(1);
  }

  const result = analyzeJS(filePath, mode, usesStdin ? fs.readFileSync(0, 'utf-8') : undefined);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { analyzeJS };
