/**
 * NEXUS CODEX HARNESS TOOL - SWARM PLAN
 * Creates a structured multi-agent swarm execution plan with role-based tasks,
 * dependency DAG, concurrency limits, and failure policies.
 * Strictly read-only; does not mutate files or execute tasks.
 */

const { swarmOrchestrator: defaultSwarmOrchestrator } = require('../SwarmOrchestrator');
const secretFilter = require('../../../security/secretFilter');

const SwarmPlanTool = {
  name: 'swarm_plan',
  description: 'Creates a structured multi-agent swarm execution plan with role-based tasks, dependency DAG, concurrency limits, and failure policies. Strictly read-only with zero mutations.',
  inputSchema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'High-level goal or objective of the multi-agent swarm',
      },
      tasks: {
        type: 'array',
        description: 'Array of role-based subagent tasks with dependencies and operational intents',
        items: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Unique identifier for this task (e.g. "task_research_auth")',
            },
            role: {
              type: 'string',
              description: 'Specialized role for this task (e.g. "researcher", "coder", "tester", "reviewer", "planner", "architect", "debugger", "devops", "designer", "specialist")',
            },
            objective: {
              type: 'string',
              description: 'Specific clear objective for the subagent to accomplish',
            },
            codingIntent: {
              type: 'string',
              enum: ['READ_ONLY', 'MUTATION'],
              description: 'Operational intent (READ_ONLY or MUTATION)',
            },
            relevantFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of workspace file paths relevant to this task',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of taskIds that must complete before this task begins',
            },
            allowMutation: {
              type: 'boolean',
              description: 'Whether the child subagent is permitted to propose code changes',
            },
            priority: {
              type: 'number',
              description: 'Scheduling priority (higher integer runs first among ready tasks)',
            },
          },
          required: ['taskId', 'role', 'objective'],
        },
      },
      maxConcurrency: {
        type: 'number',
        description: 'Maximum number of parallel subagents to execute concurrently (clamped to safety ceiling)',
      },
      failurePolicy: {
        type: 'string',
        enum: ['FAIL_FAST', 'BEST_EFFORT'],
        description: 'Policy when a subagent fails: FAIL_FAST cancels remaining tasks; BEST_EFFORT continues independent tasks',
      },
    },
    required: ['goal', 'tasks'],
  },
  requiresApproval: false,

  async execute(args = {}, context = {}) {
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: 'Arguments must be an object containing "goal" and "tasks"',
      };
    }

    const { goal, tasks, maxConcurrency, failurePolicy } = args;

    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return {
        success: false,
        error: 'Argument "goal" must be a non-empty string',
      };
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: false,
        error: 'Argument "tasks" must be a non-empty array of task objects',
      };
    }

    // Validate each task object
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t || typeof t !== 'object') {
        return {
          success: false,
          error: `Task at index ${i} is not a valid object`,
        };
      }
      if (!t.taskId || typeof t.taskId !== 'string' || !t.taskId.trim()) {
        return {
          success: false,
          error: `Task at index ${i} is missing a valid "taskId"`,
        };
      }
      if (!t.role || typeof t.role !== 'string' || !t.role.trim()) {
        return {
          success: false,
          error: `Task "${t.taskId}" is missing a valid "role"`,
        };
      }
      if (!t.objective || typeof t.objective !== 'string' || !t.objective.trim()) {
        return {
          success: false,
          error: `Task "${t.taskId}" is missing a valid "objective"`,
        };
      }
    }

    const orchestrator = context.swarmOrchestrator || context.runtime?.swarmOrchestrator || defaultSwarmOrchestrator;
    const parentThreadId = context.threadId || 'default_session';
    const parentTurnId = context.turnId || null;

    try {
      const plan = orchestrator.createPlan({
        parentThreadId,
        parentTurnId,
        goal: goal.trim(),
        tasks,
        maxConcurrency: typeof maxConcurrency === 'number' ? maxConcurrency : undefined,
        failurePolicy,
        metadata: {
          workspacePath: context.workspacePath,
          activeFilePath: context.activeFilePath,
          providerId: context.providerId,
          modelId: context.modelId,
        },
      });

      return {
        success: true,
        swarmId: plan.swarmId,
        goal: plan.goal,
        status: plan.status,
        taskCount: plan.tasks.length,
        maxConcurrency: plan.maxConcurrency,
        failurePolicy: plan.failurePolicy,
        tasks: plan.tasks.map((t) => ({
          taskId: t.taskId,
          role: t.role,
          objective: t.objective,
          codingIntent: t.codingIntent,
          relevantFiles: t.relevantFiles,
          dependencies: t.dependencies,
          allowMutation: t.allowMutation,
          priority: t.priority,
        })),
        nextRecommendedAction: `Execute this swarm plan by calling swarm_execute with swarmId "${plan.swarmId}".`,
      };
    } catch (err) {
      return {
        success: false,
        error: secretFilter.sanitizeString(err.message || 'Failed to create swarm plan'),
      };
    }
  },
};

module.exports = SwarmPlanTool;
