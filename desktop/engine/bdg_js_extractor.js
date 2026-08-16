/**
 * Behavioral Dependency Graph (BDG) JS/TS AST Extractor
 * Parses JavaScript and TypeScript files using TypeScript Compiler API (`ts.createSourceFile`)
 * and extracts normalized BDG nodes and edges matching the BDG schema.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function extractJSBDG(filePath, sourceContent, relPath) {
  const code = sourceContent !== undefined ? sourceContent : fs.readFileSync(filePath, 'utf-8');
  const relativePath = relPath || path.basename(filePath);

  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.ts')
    ? ts.ScriptKind.TS
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind);

  const nodes = {};
  const edges = [];

  const fileNodeId = `file::${relativePath}`;
  nodes[fileNodeId] = {
    id: fileNodeId,
    type: 'file',
    file: relativePath,
    symbol: path.basename(relativePath),
    location: { line: 1, col: 1 },
    language: filePath.match(/\.(ts|tsx)$/) ? 'typescript' : 'javascript',
    metadata: {},
  };

  const currentScope = [fileNodeId];
  let currentClass = null;

  function getLineCol(node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      line: start.line + 1,
      col: start.character + 1,
      endLine: end.line + 1,
      endCol: end.character + 1,
    };
  }

  function visit(node) {
    // 1. Import Declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const modNodeId = `module::${moduleSpecifier}`;
      if (!nodes[modNodeId]) {
        nodes[modNodeId] = {
          id: modNodeId,
          type: 'module',
          file: relativePath,
          symbol: moduleSpecifier,
          location: getLineCol(node),
          language: 'javascript',
          metadata: { imported: true },
        };
      }
      edges.push({
        id: `${fileNodeId}->imports->${modNodeId}::L${getLineCol(node).line}`,
        source: fileNodeId,
        target: modNodeId,
        relationship: 'imports',
        sourceLocation: getLineCol(node),
      });
    }

    // 2. Class Declarations
    else if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const classNodeId = `class::${relativePath}::${className}`;
      const isTestClass = className.startsWith('Test') || className.endsWith('Test') || className.endsWith('Spec');
      const nodeType = isTestClass ? 'test' : 'class';

      nodes[classNodeId] = {
        id: classNodeId,
        type: nodeType,
        file: relativePath,
        symbol: className,
        location: getLineCol(node),
        language: 'javascript',
        metadata: {},
      };

      const parentScope = currentScope[currentScope.length - 1];
      edges.push({
        id: `${parentScope}->instantiates->${classNodeId}::L${getLineCol(node).line}`,
        source: parentScope,
        target: classNodeId,
        relationship: 'instantiates',
        sourceLocation: getLineCol(node),
      });

      // Class Inheritance (heritage clauses)
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const typeNode of clause.types) {
              const baseName = typeNode.expression.getText(sourceFile);
              const baseNodeId = `class::${relativePath}::${baseName}`;
              edges.push({
                id: `${classNodeId}->inherits->${baseNodeId}::L${getLineCol(node).line}`,
                source: classNodeId,
                target: baseNodeId,
                relationship: 'inherits',
                sourceLocation: getLineCol(node),
              });
            }
          }
        }
      }

      currentScope.push(classNodeId);
      const prevClass = currentClass;
      currentClass = classNodeId;
      ts.forEachChild(node, visit);
      currentClass = prevClass;
      currentScope.pop();
      return;
    }

    // 3. Function & Method Declarations
    else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const funcName = node.name ? node.name.getText(sourceFile) : 'anonymous';
      const scopedName = currentClass ? `${currentClass.split('::').pop()}.${funcName}` : funcName;
      const funcNodeId = `function::${relativePath}::${scopedName}`;
      const isTestFunc = funcName.startsWith('test') || funcName.startsWith('it') || funcName.startsWith('describe');
      const nodeType = isTestFunc ? 'test' : 'function';

      nodes[funcNodeId] = {
        id: funcNodeId,
        type: nodeType,
        file: relativePath,
        symbol: scopedName,
        location: getLineCol(node),
        language: 'javascript',
        metadata: {},
      };

      const parentScope = currentScope[currentScope.length - 1];
      edges.push({
        id: `${parentScope}->contains->${funcNodeId}::L${getLineCol(node).line}`,
        source: parentScope,
        target: funcNodeId,
        relationship: parentScope.startsWith('function::') ? 'calls' : 'instantiates',
        sourceLocation: getLineCol(node),
      });

      currentScope.push(funcNodeId);
      ts.forEachChild(node, visit);
      currentScope.pop();
      return;
    }

    // 4. Variable Declarations
    else if (ts.isVariableDeclaration(node) && node.name) {
      const varName = node.name.getText(sourceFile);
      const parentScope = currentScope[currentScope.length - 1];

      if (varName && !['err', 'e', 'i', 'j', 'req', 'res', 'next'].includes(varName)) {
        const varNodeId = `variable::${relativePath}::${varName}`;
        if (!nodes[varNodeId]) {
          nodes[varNodeId] = {
            id: varNodeId,
            type: 'variable',
            file: relativePath,
            symbol: varName,
            location: getLineCol(node),
            language: 'javascript',
            metadata: {},
          };
        }
        edges.push({
          id: `${parentScope}->writes->${varNodeId}::L${getLineCol(node).line}`,
          source: parentScope,
          target: varNodeId,
          relationship: 'writes',
          sourceLocation: getLineCol(node),
        });
      }
    }

    // 5. Function Calls & Invocations
    else if (ts.isCallExpression(node)) {
      const parentScope = currentScope[currentScope.length - 1];
      const expressionText = node.expression.getText(sourceFile);
      const funcName = expressionText.split('.').pop();

      if (funcName) {
        // Database Operations
        if (['query', 'execute', 'find', 'findOne', 'insertOne', 'updateOne', 'deleteOne', 'save'].includes(funcName)) {
          const dbNodeId = `database-op::${relativePath}::${funcName}::L${getLineCol(node).line}`;
          nodes[dbNodeId] = {
            id: dbNodeId,
            type: 'database-op',
            file: relativePath,
            symbol: `DB.${funcName}`,
            location: getLineCol(node),
            language: 'javascript',
            metadata: { operation: funcName },
          };
          const rel = ['query', 'find', 'findOne'].includes(funcName) ? 'database-read' : 'database-write';
          edges.push({
            id: `${parentScope}->${rel}->${dbNodeId}::L${getLineCol(node).line}`,
            source: parentScope,
            target: dbNodeId,
            relationship: rel,
            sourceLocation: getLineCol(node),
          });
        }
        // External API Calls
        else if (['fetch', 'axios', 'get', 'post', 'put', 'delete', 'patch', 'request'].includes(funcName) || expressionText.includes('http')) {
          const apiNodeId = `external-api::${relativePath}::${funcName}::L${getLineCol(node).line}`;
          nodes[apiNodeId] = {
            id: apiNodeId,
            type: 'external-api',
            file: relativePath,
            symbol: `HTTP.${funcName.toUpperCase()}`,
            location: getLineCol(node),
            language: 'javascript',
            metadata: { method: funcName.toUpperCase() },
          };
          edges.push({
            id: `${parentScope}->external-call->${apiNodeId}::L${getLineCol(node).line}`,
            source: parentScope,
            target: apiNodeId,
            relationship: 'external-call',
            sourceLocation: getLineCol(node),
          });
        }
        // Regular Function Call
        else {
          const targetFuncId = `function::${relativePath}::${funcName}`;
          edges.push({
            id: `${parentScope}->calls->${funcName}::L${getLineCol(node).line}`,
            source: parentScope,
            target: targetFuncId,
            relationship: parentScope.toLowerCase().includes('test') || parentScope.toLowerCase().includes('spec') ? 'test-covers' : 'calls',
            sourceLocation: getLineCol(node),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { nodes, edges };
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(JSON.stringify({ error: `File not found: ${filePath}` }));
    process.exit(1);
  }
  const relPath = process.argv[3] || path.basename(filePath);
  const result = extractJSBDG(filePath, undefined, relPath);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { extractJSBDG };
