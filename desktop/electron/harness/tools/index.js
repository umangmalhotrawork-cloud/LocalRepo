/**
 * NEXUS CODEX HARNESS - TOOL BUNDLE & INITIALIZER
 */

const ReadFileTool = require('./ReadFileTool');
const SearchWorkspaceTool = require('./SearchWorkspaceTool');
const RunTestsTool = require('./RunTestsTool');
const { RunCommandTool } = require('./RunCommandTool');
const ApplyPatchTool = require('./ApplyPatchTool');
const SwarmPlanTool = require('./SwarmPlanTool');
const SwarmExecuteTool = require('./SwarmExecuteTool');
const SwarmCancelTool = require('./SwarmCancelTool');
const { toolRegistry } = require('../ToolRegistry');

/**
 * Registers all core normalized tools onto the provided or default ToolRegistry.
 * @param {import('../ToolRegistry').ToolRegistry} [registry]
 */
function registerCoreTools(registry = toolRegistry) {
  registry.register(ReadFileTool);
  registry.register(SearchWorkspaceTool);
  registry.register(RunTestsTool);
  registry.register(RunCommandTool);
  registry.register(ApplyPatchTool);
  registry.register(SwarmPlanTool);
  registry.register(SwarmExecuteTool);
  registry.register(SwarmCancelTool);
}

// Auto-register core tools on the default global toolRegistry
registerCoreTools(toolRegistry);

module.exports = {
  ReadFileTool,
  SearchWorkspaceTool,
  RunTestsTool,
  RunCommandTool,
  ApplyPatchTool,
  SwarmPlanTool,
  SwarmExecuteTool,
  SwarmCancelTool,
  registerCoreTools,
};
