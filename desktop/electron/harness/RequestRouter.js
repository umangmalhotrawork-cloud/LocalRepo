/**
 * NEXUS CODEX HARNESS - AUTHORITATIVE REQUEST & INTENT ROUTER (MILESTONE 4)
 * 
 * Provides a single, provider-neutral, deterministic boundary to classify
 * incoming user requests into:
 * 1. CONVERSATION (General chat, conceptual inquiries, theoretical explanations)
 * 2. CODING_TASK (READ_ONLY: inspection/search/tests, MUTATION: changes/patches/fixes)
 */

const path = require('path');

const ROUTER_MODES = {
  CONVERSATION: 'CONVERSATION',
  CODING_TASK: 'CODING_TASK',
};

const CODING_INTENTS = {
  READ_ONLY: 'READ_ONLY',
  MUTATION: 'MUTATION',
};

const FILE_EXTENSIONS = [
  '.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css',
  '.yaml', '.yml', '.sql', '.go', '.rs', '.java', '.cpp', '.c',
  '.h', '.md', '.toml', '.env', '.sh'
];

const CASUAL_GREETINGS = [
  'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'good night',
  'how are you', 'how are you doing', "how's it going", 'how is it going', 'how do you do',
  'what is up', "what's up", 'yo', 'sup', 'howdy', 'test', 'ping',
  'who are you', 'what are you', 'tell me about yourself', 'what is your name',
  'thank you', 'thanks', 'thank you so much', 'thx', 'ty',
  'cool', 'nice', 'awesome', 'great', 'okay', 'ok', 'yes', 'no', 'yep', 'nope',
  'what can you do', 'what do you do', 'how can you help', 'how do you work',
  'tell me about nexus', 'what is nexus'
];

const CONCEPTUAL_PREFIXES = [
  'what is', 'what are', 'explain', 'tell me about', 'how does', 'why is',
  'who is', 'who are', 'define', 'how to use', 'what does', 'help me understand'
];

const REPO_WORKSPACE_TARGETS = [
  'this repository', 'this repo', 'this codebase', 'this workspace', 'this project',
  'the repository', 'the repo', 'the codebase', 'the workspace', 'the project',
  'in this repository', 'in this repo', 'in this codebase', 'in this workspace', 'in this project'
];

const DIAGNOSTIC_VERBS = [
  'inspect', 'analyze', 'audit', 'review', 'find', 'search', 'locate', 'diagnose',
  'check', 'scan', 'trace', 'examine'
];

const MUTATION_VERBS = [
  'fix', 'refactor', 'remove', 'delete', 'change', 'modify',
  'apply', 'implement', 'rewrite', 'replace', 'add', 'upgrade', 'patch',
  'create', 'build', 'write', 'update', 'clean', 'cleanup', 'format', 'repair',
  'integrate', 'scaffold', 'restructure', 'optimize', 'resolve', 'solve', 'bug', 'generate'
];

const CONVERSATIONAL_PROJECT_PATTERNS = [
  'explain what this project does', 'what does this project do', 'explain this project',
  'what is this project', 'what is this repo', 'tell me about this project',
  'tell me about this codebase', 'help me understand this project', 'how does authentication work'
];

const TEST_COMMAND_PATTERNS = [
  'run tests', 'run the tests', 'execute tests', 'run test', 'test suite',
  'pytest', 'npm test', 'jest', 'cargo test', 'go test', 'test failures',
  'unit test', 'unit tests', 'generate tests', 'generate unit tests'
];

const NEGATIVE_MUTATION_DIRECTIVES = [
  'do not modify', "don't modify", 'do not change', "don't change",
  'read only', 'read-only', 'analysis only', 'without modifying',
  'without changing', 'without changes', 'do not alter', "don't alter",
  'no code changes', 'do not edit', "don't edit"
];

class RequestRouter {
  /**
   * Authoritatively classifies an incoming user prompt.
   * @param {string} userInput - The raw user prompt
   * @param {Object} [context] - Execution context
   * @param {string} [context.activeFilePath] - Currently active file in editor
   * @param {string} [context.workspacePath] - Workspace directory
   * @param {boolean} [context.isExplicitEditorTarget] - Whether user triggered an editor-specific action
   * @param {string} [context.selectionText] - Active editor selection text
   * @returns {{
   *   mode: 'CONVERSATION' | 'CODING_TASK',
   *   codingIntent: 'READ_ONLY' | 'MUTATION' | null,
   *   confidence: number,
   *   reasons: string[],
   *   requiresWorkspace: boolean
   * }}
   */
  classify(userInput = '', context = {}) {
    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 1.0,
        reasons: ['empty_input'],
        requiresWorkspace: false,
      };
    }

    const raw = userInput.trim();
    const text = raw.toLowerCase();
    const reasons = [];

    const activeFilePath = context.activeFilePath || null;
    const isExplicitEditorTarget = Boolean(context.isExplicitEditorTarget || context.selectionText);

    // 1. Check for Exact Casual Greetings
    const isCasual = CASUAL_GREETINGS.some((phrase) => {
      return text === phrase ||
        text.startsWith(phrase + ' ') ||
        text.startsWith(phrase + '?') ||
        text.startsWith(phrase + '!') ||
        text.startsWith(phrase + ',');
    });

    // 2. Check for File Mentions & Paths
    const fileMatches = [];
    const tokens = raw.split(/[\s,;()]+/);
    for (const token of tokens) {
      const cleanToken = token.replace(/^[("'<{[]+|[)"'>}\],.]+$/g, '');
      const lower = cleanToken.toLowerCase();
      if (FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        fileMatches.push(cleanToken);
      } else if (cleanToken.includes('/') || cleanToken.includes('\\')) {
        fileMatches.push(cleanToken);
      }
    }
    const hasExplicitFileMention = fileMatches.length > 0;
    if (hasExplicitFileMention) {
      reasons.push(`explicit_files_mentioned: ${fileMatches.join(', ')}`);
    }

    // 3. Check for Explicit Workspace / Repo Targeting
    const hasRepoTargeting = REPO_WORKSPACE_TARGETS.some((target) => text.includes(target));
    if (hasRepoTargeting) {
      reasons.push('explicit_repo_or_workspace_target');
    }

    // 4. Check for Test Runner Invocations
    const hasTestRequest = TEST_COMMAND_PATTERNS.some((pat) => text.includes(pat));
    if (hasTestRequest) {
      reasons.push('test_execution_command');
    }

    // 5. Check for Explicit Negative Mutation Directives (Forces READ_ONLY)
    const hasNegativeMutationDirective = NEGATIVE_MUTATION_DIRECTIVES.some((dir) => text.includes(dir));
    if (hasNegativeMutationDirective) {
      reasons.push('explicit_negative_mutation_directive');
    }

    // 6. Check for Mutation Verbs
    const hasMutationVerb = MUTATION_VERBS.some((verb) => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(text);
    });
    if (hasMutationVerb) {
      reasons.push('code_mutation_verb_detected');
    }

    // 7. Check for Diagnostic / Inspection Verbs
    const hasDiagnosticVerb = DIAGNOSTIC_VERBS.some((verb) => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(text);
    });
    if (hasDiagnosticVerb) {
      reasons.push('diagnostic_verb_detected');
    }

    // 8. Check for Contextual "This File" / "This Function" Reference
    const hasContextualTarget = (
      text.includes('this file') ||
      text.includes('this function') ||
      text.includes('this method') ||
      text.includes('this class') ||
      text.includes('this code') ||
      text.includes('the current file') ||
      text.includes('selected code')
    );
    const hasActiveFileContext = Boolean(hasContextualTarget && activeFilePath);
    if (hasActiveFileContext) {
      reasons.push(`active_file_context: ${path.basename(activeFilePath)}`);
    }

    // 9. Check for Conceptual / Knowledge Question Pattern
    const isConceptualQuery = CONCEPTUAL_PREFIXES.some((prefix) => {
      return text.startsWith(prefix + ' ') || text.startsWith(prefix + '?');
    });

    // ----------------------------------------------------
    // DECISION MATRIX
    // ----------------------------------------------------

    // CASE A: Casual greetings with no files and no mutation
    if (isCasual && !hasExplicitFileMention && !hasMutationVerb) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.98,
        reasons: ['casual_conversation_pattern'],
        requiresWorkspace: false,
      };
    }

    // CASE A2: Conversational project questions
    if (CONVERSATIONAL_PROJECT_PATTERNS.some((pat) => text.includes(pat)) && !hasMutationVerb && !hasExplicitFileMention) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.95,
        reasons: ['conversational_project_overview'],
        requiresWorkspace: false,
      };
    }

    // CASE B: Conceptual knowledge inquiries without explicit repository/file targets
    // Example: "what is recursion?", "explain recursion in Python", "tell me about Python", "what is the architecture of NEXUS?"
    if (isConceptualQuery && !hasExplicitFileMention && !hasRepoTargeting && !hasActiveFileContext && !hasMutationVerb && !hasTestRequest) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.95,
        reasons: ['conceptual_technical_question'],
        requiresWorkspace: false,
      };
    }

    // CASE C: Explicit Coding Task (File, Repo Target, Test, Active File Action, Diagnostic, or Code Mutation)
    const isCodingTask = (
      hasExplicitFileMention ||
      hasRepoTargeting ||
      hasTestRequest ||
      hasActiveFileContext ||
      isExplicitEditorTarget ||
      hasDiagnosticVerb ||
      (hasMutationVerb && (hasDiagnosticVerb || hasRepoTargeting || activeFilePath)) ||
      (hasMutationVerb && !isConceptualQuery)
    );

    if (isCodingTask) {
      // Determine READ_ONLY vs MUTATION
      if (hasNegativeMutationDirective) {
        return {
          mode: ROUTER_MODES.CODING_TASK,
          codingIntent: CODING_INTENTS.READ_ONLY,
          confidence: 0.95,
          reasons: [...reasons, 'enforced_read_only_via_negative_directive'],
          requiresWorkspace: true,
        };
      }

      if (hasMutationVerb) {
        return {
          mode: ROUTER_MODES.CODING_TASK,
          codingIntent: CODING_INTENTS.MUTATION,
          confidence: 0.92,
          reasons: [...reasons, 'actionable_code_mutation_intent'],
          requiresWorkspace: true,
        };
      }

      // If no mutation verb, it is an inspection/diagnostic/test request
      return {
        mode: ROUTER_MODES.CODING_TASK,
        codingIntent: CODING_INTENTS.READ_ONLY,
        confidence: 0.90,
        reasons: [...reasons, 'actionable_read_only_intent'],
        requiresWorkspace: true,
      };
    }

    // CASE D: Ambiguous or unclassified requests
    // Rule: Resolve conservatively toward CONVERSATION unless there is strong coding evidence
    return {
      mode: ROUTER_MODES.CONVERSATION,
      codingIntent: null,
      confidence: 0.60,
      reasons: ['conservative_fallback_conversation'],
      requiresWorkspace: false,
    };
  }
}

const PURE_GREETINGS = new Set([
  'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'good night',
  'how are you', 'how are you doing', "how's it going", 'how is it going', 'how do you do',
  'what is up', "what's up", 'yo', 'sup', 'howdy',
  'who are you', 'what are you', 'tell me about yourself', 'what is your name',
  'thank you', 'thanks', 'thank you so much', 'thx', 'ty',
  'cool', 'nice', 'awesome', 'great', 'okay', 'ok', 'yes', 'no', 'yep', 'nope',
  'hi there', 'hello there', 'hey there',
]);

/**
 * Fast deterministic check if input is a simple greeting / conversational message.
 * @param {string} userInput
 * @returns {boolean}
 */
function isGreeting(userInput = '') {
  if (!userInput || typeof userInput !== 'string') return false;
  const raw = userInput.trim();
  const text = raw.toLowerCase().replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();
  if (!text) return false;

  return PURE_GREETINGS.has(text);
}

/**
 * Returns a polished conversational response for greetings without workspace inspection or AI calls.
 * @param {string} userInput
 * @returns {string}
 */
function getConversationalGreetingResponse(userInput = '') {
  const raw = (userInput || '').trim();
  const text = raw.toLowerCase().replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();

  if (['thanks', 'thank you', 'thank you so much', 'thx', 'ty'].includes(text) || text.startsWith('thanks') || text.startsWith('thank you')) {
    return "You're welcome! Let me know if you need anything else.";
  }
  if (['good morning', 'morning'].includes(text) || text.startsWith('good morning')) {
    return 'Good morning! How can I help with your project today?';
  }
  if (['good afternoon'].includes(text) || text.startsWith('good afternoon')) {
    return 'Good afternoon! How can I help with your project today?';
  }
  if (['good evening', 'evening'].includes(text) || text.startsWith('good evening')) {
    return 'Good evening! How can I help with your project today?';
  }
  if (['good night', 'night'].includes(text) || text.startsWith('good night')) {
    return 'Good night! Have a great rest.';
  }
  if (['how are you', 'how are you doing', "how's it going", 'how is it going', 'what is up', "what's up", 'sup'].includes(text)) {
    return "I'm doing well, thank you! How can I help you today?";
  }
  if (['okay', 'ok', 'cool', 'nice', 'awesome', 'great', 'sure', 'alright'].includes(text)) {
    return "Sounds good! Let me know what you'd like to work on.";
  }
  if (['yes', 'no', 'yep', 'nope'].includes(text)) {
    return 'Understood! How can I help you?';
  }
  return 'Hello! 👋 How can I help?';
}

const requestRouter = new RequestRouter();

module.exports = {
  RequestRouter,
  requestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
  CASUAL_GREETINGS,
  isGreeting,
  getConversationalGreetingResponse,
};
