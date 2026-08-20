/**
 * NEXUS CODEX HARNESS TOOL - RUN COMMAND
 * Executes non-destructive CLI commands within the workspace boundary.
 * Enforces safety boundaries and policy evaluations for high-risk / destructive commands.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const secretFilter = require('../../../security/secretFilter');

const MAX_COMMAND_OUTPUT_BYTES = 50 * 1024; // 50 KB output limit
const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 1000; // 30s timeout

// High risk commands that must always trigger the approval boundary
const HIGH_RISK_COMMAND_PATTERNS = [
  /\brm\s+(-[rfRF]+\s+|--recursive\s+)/,
  /\bsudo\b/,
  /\bchmod\s+([0-7]{3,4}|-R)/,
  /\bchown\b/,
  /\bmkfs\b/,
  /\bdd\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bkill\s+-9\b/,
  /\bpkill\b/,
  /\bcurl\b.*\|\s*(sh|bash|zsh)/,
  /\bwget\b.*\|\s*(sh|bash|zsh)/,
  /\bgit\s+(push|clean\s+-f|reset\s+--hard)/,
];

function evaluateCommandPolicy(command, approvalMode = 'strict') {
  const cmd = (command || '').trim();

  // Check dangerous patterns
  for (const pattern of HIGH_RISK_COMMAND_PATTERNS) {
    if (pattern.test(cmd)) {
      return {
        safe: false,
        riskLevel: 'CRITICAL',
        requiresApproval: true,
        reason: 'Command matches high-risk or destructive operation pattern',
      };
    }
  }

  // If in strict approval mode, require explicit approval for any state-modifying action
  if (approvalMode === 'manual') {
    return {
      safe: false,
      riskLevel: 'REVIEW_REQUIRED',
      requiresApproval: true,
      reason: 'Manual approval mode is active',
    };
  }

  return {
    safe: true,
    riskLevel: 'LOW',
    requiresApproval: false,
    reason: 'Command passes safety policy evaluation',
  };
}

const RunCommandTool = {
  name: 'run_command',
  description: 'Executes a command inside the workspace directory subject to policy boundary validation.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command line string to execute',
      },
      cwd: {
        type: 'string',
        description: 'Optional subfolder working directory relative to workspace root',
      },
    },
    required: ['command'],
  },
  requiresApproval: true,

  async execute(args = {}, context = {}) {
    const rawCommand = args.command || '';
    if (!rawCommand || typeof rawCommand !== 'string' || !rawCommand.trim()) {
      return {
        success: false,
        error: 'Argument "command" must be a non-empty string',
      };
    }

    const workspaceRoot = path.resolve(context.workspacePath || process.cwd());
    let cwd = workspaceRoot;

    if (args.cwd && typeof args.cwd === 'string' && args.cwd.trim()) {
      const candidateCwd = path.resolve(workspaceRoot, args.cwd.trim());
      if (!candidateCwd.startsWith(workspaceRoot + path.sep) && candidateCwd !== workspaceRoot) {
        return {
          success: false,
          error: `Security Violation: Working directory "${args.cwd}" escapes workspace boundary`,
        };
      }
      if (fs.existsSync(candidateCwd) && fs.statSync(candidateCwd).isDirectory()) {
        cwd = candidateCwd;
      }
    }

    // Evaluate policy boundary
    const policy = evaluateCommandPolicy(rawCommand, context.approvalMode);
    if (!policy.safe && policy.requiresApproval && !context.isApproved) {
      return {
        success: false,
        requiresApproval: true,
        policyDecision: policy,
        error: `Command execution requires approval under safety policy (${policy.riskLevel}): "${rawCommand}"`,
      };
    }

    // Execute in sandboxed process
    const isWin = process.platform === 'win32';
    const shellCmd = isWin ? 'cmd.exe' : '/bin/sh';
    const shellArgs = isWin ? ['/d', '/s', '/c', rawCommand] : ['-c', rawCommand];
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let isTimedOut = false;

      const child = spawn(shellCmd, shellArgs, {
        cwd,
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
        },
      });

      const timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (e) {}
          }, 1000);
        } catch (e) {}
      }, DEFAULT_COMMAND_TIMEOUT_MS);

      child.stdout?.on('data', (chunk) => {
        if (stdoutBuffer.length < MAX_COMMAND_OUTPUT_BYTES) {
          stdoutBuffer += chunk.toString('utf-8');
        }
      });

      child.stderr?.on('data', (chunk) => {
        if (stderrBuffer.length < MAX_COMMAND_OUTPUT_BYTES) {
          stderrBuffer += chunk.toString('utf-8');
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        resolve({
          success: false,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          stdout: secretFilter.sanitizeString(stdoutBuffer),
          stderr: secretFilter.sanitizeString(err.message),
          error: `Failed to spawn command process: ${err.message}`,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        const safeStdout = secretFilter.sanitizeString(stdoutBuffer);
        const safeStderr = secretFilter.sanitizeString(stderrBuffer);

        if (isTimedOut) {
          return resolve({
            success: false,
            exitCode: 124,
            durationMs,
            stdout: safeStdout,
            stderr: safeStderr,
            error: `Command timed out after ${DEFAULT_COMMAND_TIMEOUT_MS}ms`,
          });
        }

        resolve({
          success: code === 0,
          exitCode: code !== null ? code : 1,
          durationMs,
          stdout: safeStdout,
          stderr: safeStderr,
          command: secretFilter.sanitizeString(rawCommand),
          error: code !== 0 ? `Command exited with status code ${code}` : null,
        });
      });
    });
  },
};

module.exports = {
  RunCommandTool,
  evaluateCommandPolicy,
};
