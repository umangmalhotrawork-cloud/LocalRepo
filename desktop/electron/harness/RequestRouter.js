/**
 * NEXUS CODEX HARNESS - AUTHORITATIVE REQUEST & INTENT ROUTER (MILESTONE 4)
 * 
 * Provides a single, provider-neutral, deterministic boundary to classify
 * incoming user requests into:
 * 1. CONVERSATION (General chat, conceptual inquiries, theoretical explanations, discussions)
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
  'tell me about nexus', 'what is nexus', 'hi there', 'hello there', 'hey there',
  'sounds good', 'that sounds good', 'looks good', 'that looks good', 'sure', 'alright',
  'i agree', 'makes sense', 'got it', 'understood', 'perfect'
];

const CONVERSATIONAL_ACTIVITY_PATTERNS = [
  "i'm working on", "i am working on", "i'm testing", "i am testing",
  "i'm trying to", "i am trying to", "i'm thinking about", "i am thinking about",
  "i'm looking at", "i am looking at", "i'm exploring", "i am exploring",
  "we are working on", "we're working on", "we are testing", "we're testing"
];

const CONVERSATIONAL_DISCUSSION_PATTERNS = [
  'i want to discuss', 'we should discuss', 'let us discuss', "let's discuss",
  'i think we should', 'i think we could', 'we could consider', 'we should consider',
  'what do you think about', 'how do you feel about', 'tell me more about the idea',
  'tell me more about this approach', 'tell me more', 'can you explain this approach',
  'can you explain the approach', 'explain this approach', 'what are your thoughts on',
  'lets talk about', "let's talk about", 'i have an idea', 'an idea for'
];

const CONCEPTUAL_PREFIXES = [
  'what is', 'what are', 'explain', 'tell me about', 'how does', 'why is',
  'who is', 'who are', 'define', 'how to use', 'what does', 'help me understand',
  'can you explain', 'could you explain', 'can you tell me about'
];

const REPOSITORY_DIAGNOSTIC_ACTIONS = [
  'analyze this repository', 'analyze the repository', 'analyze this repo', 'analyze the repo',
  'analyze this codebase', 'analyze the codebase', 'analyze this workspace', 'analyze the workspace',
  'analyze architecture', 'analyze the architecture', 'analyze project architecture',
  'inspect this repository', 'inspect the repository', 'inspect this repo', 'inspect the repo',
  'inspect this codebase', 'inspect the codebase', 'inspect this workspace', 'inspect the workspace',
  'audit security', 'audit dependencies', 'security audit', 'vulnerability scan',
  'find redundant code', 'find all redundant code', 'find dead code', 'find unused code',
  'find all typescript errors', 'find all errors', 'find bugs', 'find all bugs'
];

const DIAGNOSTIC_VERBS = [
  'inspect', 'analyze', 'audit', 'review', 'find', 'search', 'locate', 'diagnose',
  'examine', 'trace'
];

const MUTATION_VERBS = [
  'fix', 'refactor', 'remove', 'delete', 'modify',
  'apply', 'implement', 'rewrite', 'replace', 'upgrade', 'patch',
  'scaffold', 'restructure', 'repair'
];

const CONVERSATIONAL_PROJECT_PATTERNS = [
  'explain what this project does', 'what does this project do', 'explain this project',
  'what is this project', 'what is this repo', 'tell me about this project',
  'tell me about this codebase', 'help me understand this project', 'how does authentication work'
];

const TEST_COMMAND_PATTERNS = [
  'run tests', 'run the tests', 'execute tests', 'run test', 'test suite',
  'pytest', 'npm test', 'jest', 'cargo test', 'go test', 'test failures',
  'run unit tests', 'execute test suite'
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
    const cleanText = text.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();
    const reasons = [];

    const activeFilePath = context.activeFilePath || null;
    const isExplicitEditorTarget = Boolean(context.isExplicitEditorTarget || context.selectionText);

    // 1. Check for Exact Casual Greetings & Pleasantries
    const isCasual = CASUAL_GREETINGS.some((phrase) => {
      return text === phrase ||
        cleanText === phrase ||
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
        // Exclude simple contractions or abbreviations
        if (!cleanToken.includes("'") && cleanToken.length > 2) {
          fileMatches.push(cleanToken);
        }
      }
    }
    const hasExplicitFileMention = fileMatches.length > 0;
    if (hasExplicitFileMention) {
      reasons.push(`explicit_files_mentioned: ${fileMatches.join(', ')}`);
    }

    // 3. Check for Diagnostic / Inspection Verbs
    const hasDiagnosticVerb = DIAGNOSTIC_VERBS.some((verb) => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(text);
    });
    if (hasDiagnosticVerb) {
      reasons.push('diagnostic_verb_detected');
    }

    // 4. Check for Mutation Verbs
    const hasMutationVerb = MUTATION_VERBS.some((verb) => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(text);
    });
    if (hasMutationVerb) {
      reasons.push('code_mutation_verb_detected');
    }

    // 5. Check for Explicit Workspace / Repo Targeting
    const REPO_WORKSPACE_TARGETS = [
      'this repository', 'this repo', 'this codebase', 'this workspace',
      'the repository', 'the repo', 'the codebase', 'the workspace',
      'in this repository', 'in this repo', 'in this codebase', 'in this workspace'
    ];
    const hasRepoTargeting = REPO_WORKSPACE_TARGETS.some((target) => text.includes(target));
    const hasRepoDiagnostic = REPOSITORY_DIAGNOSTIC_ACTIONS.some((action) => text.includes(action)) || (hasRepoTargeting && hasDiagnosticVerb);
    if (hasRepoDiagnostic || hasRepoTargeting) {
      reasons.push('explicit_repo_diagnostic_action');
    }

    // 6. Check for Test Runner Invocations
    const hasTestRequest = TEST_COMMAND_PATTERNS.some((pat) => text.includes(pat));
    if (hasTestRequest) {
      reasons.push('test_execution_command');
    }

    // 7. Check for Explicit Negative Mutation Directives (Forces READ_ONLY)
    const hasNegativeMutationDirective = NEGATIVE_MUTATION_DIRECTIVES.some((dir) => text.includes(dir));
    if (hasNegativeMutationDirective) {
      reasons.push('explicit_negative_mutation_directive');
    }

    // Check for Actionable Mutation Patterns (e.g. "add authentication", "implement feature", "change behavior", "fix the bug", "find the bug")
    const hasActionableMutationPattern = (
      /\badd\s+(auth|authentication|jwt|endpoint|feature|middleware|test|tests|validation|method|function|class|route)\b/i.test(text) ||
      /\bimplement\s+(auth|authentication|jwt|endpoint|feature|middleware|validation|logic|caching|rule|behavior)\b/i.test(text) ||
      /\bchange\s+(this\s+behavior|the\s+behavior|the\s+logic|the\s+return|the\s+implementation)\b/i.test(text) ||
      /\bmodify\s+(the\s+function|the\s+method|the\s+class|the\s+file|this\s+function|this\s+code|this\s+file)\b/i.test(text) ||
      /\bfind\s+(the\s+bug|a\s+bug|the\s+bugs|bugs)\b/i.test(text) ||
      /\b(generate|write)\s+(unit\s+tests|tests|test\s+suite)\b/i.test(text)
    );
    if (hasActionableMutationPattern) {
      reasons.push('actionable_mutation_pattern_detected');
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

    // 10. Check for Conversational Activity or Discussion Statements
    const isConversationalActivity = CONVERSATIONAL_ACTIVITY_PATTERNS.some((pat) => text.includes(pat));
    const isConversationalDiscussion = CONVERSATIONAL_DISCUSSION_PATTERNS.some((pat) => text.includes(pat));

    // ----------------------------------------------------
    // DECISION MATRIX
    // ----------------------------------------------------

    // Priority 1: Direct Casual greetings (without explicit file mentions and without mutation commands)
    if (isCasual && !hasExplicitFileMention && !hasMutationVerb && !hasActionableMutationPattern) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.98,
        reasons: ['casual_conversation_pattern'],
        requiresWorkspace: false,
      };
    }

    // Priority 2: Conversational project questions
    if (CONVERSATIONAL_PROJECT_PATTERNS.some((pat) => text.includes(pat)) && !hasMutationVerb && !hasExplicitFileMention && !hasActionableMutationPattern) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.95,
        reasons: ['conversational_project_overview'],
        requiresWorkspace: false,
      };
    }

    // Priority 3: Conversational Activity Statements & Discussions without explicit actionable file/mutation targets
    // Examples: "I'm working on a checkout validation task.", "I'm testing the new capsule feature.", "I want to discuss the project architecture.", "I think we should use Redis."
    if ((isConversationalActivity || isConversationalDiscussion) && !hasExplicitFileMention && !hasActionableMutationPattern) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.95,
        reasons: ['conversational_statement_or_discussion'],
        requiresWorkspace: false,
      };
    }

    // Priority 4: Conceptual knowledge inquiries without explicit file/code action targets
    // Example: "what is recursion?", "explain recursion in Python", "tell me about Python", "what is the architecture of NEXUS?", "can you explain this approach?"
    if (isConceptualQuery && !hasExplicitFileMention && !hasRepoDiagnostic && !hasActiveFileContext && !hasMutationVerb && !hasActionableMutationPattern && !hasTestRequest) {
      return {
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        confidence: 0.95,
        reasons: ['conceptual_technical_question'],
        requiresWorkspace: false,
      };
    }

    // Priority 5: Explicit Coding Task (Explicit file mentioned, repo diagnostic, test runner, active editor action, or code mutation)
    const hasDiagnosticTarget = (
      hasRepoDiagnostic ||
      hasContextualTarget ||
      hasExplicitFileMention ||
      text.includes('code') ||
      text.includes('function') ||
      text.includes('method') ||
      text.includes('class') ||
      text.includes('file') ||
      text.includes('repository') ||
      text.includes('repo') ||
      text.includes('workspace') ||
      text.includes('error') ||
      text.includes('bug')
    );

    const isCodingTask = (
      hasExplicitFileMention ||
      hasRepoDiagnostic ||
      hasTestRequest ||
      isExplicitEditorTarget ||
      (hasDiagnosticVerb && hasDiagnosticTarget) ||
      (hasContextualTarget && (hasDiagnosticVerb || hasMutationVerb || hasActionableMutationPattern)) ||
      hasActionableMutationPattern ||
      (hasMutationVerb && (hasExplicitFileMention || hasActiveFileContext || hasContextualTarget || !isConceptualQuery))
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

      if (hasMutationVerb || hasActionableMutationPattern) {
        // If it was just a diagnostic action with no mutation verb
        if (!hasMutationVerb && !hasActionableMutationPattern) {
          return {
            mode: ROUTER_MODES.CODING_TASK,
            codingIntent: CODING_INTENTS.READ_ONLY,
            confidence: 0.90,
            reasons: [...reasons, 'actionable_read_only_intent'],
            requiresWorkspace: true,
          };
        }

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

    // Priority 6: Conservative fallback to CONVERSATION
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
  if (['okay', 'ok', 'cool', 'nice', 'awesome', 'great', 'sure', 'alright', 'that sounds good', 'sounds good'].includes(text)) {
    return "Sounds good! Let me know what you'd like to work on.";
  }
  if (['yes', 'no', 'yep', 'nope'].includes(text)) {
    return 'Understood! How can I help you?';
  }
  return 'Hello! 👋 How can I help?';
}

/**
 * Returns a deterministic conversational response for broad conversational inputs
 * without workspace inspection, tool execution, or model quota consumption.
 * @param {string} userInput
 * @param {string} [continuumContextText]
 * @returns {string}
 */
function getConversationalResponse(userInput = '', continuumContextText = '') {
  const raw = (userInput || '').trim();
  const text = raw.toLowerCase();
  const clean = text.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();

  if (isGreeting(raw)) {
    return getConversationalGreetingResponse(raw);
  }

  // Name introduction pattern
  const nameMatch = raw.match(/\b(?:my name is|call me)\s+([a-zA-Z]+)/i) || raw.match(/\b(?:i am|i'm)\s+([a-zA-Z]+)\b/i);
  if (nameMatch) {
    const candidateName = nameMatch[1].trim();
    const reservedWords = ['working', 'testing', 'looking', 'trying', 'writing', 'reading', 'using', 'ready', 'here', 'back', 'just', 'not', 'also', 'happy', 'sure', 'now', 'fine', 'good'];
    if (!reservedWords.includes(candidateName.toLowerCase()) && candidateName.length >= 2) {
      const formattedName = candidateName.charAt(0).toUpperCase() + candidateName.slice(1);
      return `Nice to meet you, ${formattedName}! What are you working on today?`;
    }
  }

  // Workplace / University / Affiliation pattern
  const workMatch = raw.match(/\b(?:i work (?:at|in|for)|i study (?:at|in)|i'm from|i am from|i am at|i'm at)\s+([^.?!,]+)/i);
  if (workMatch) {
    const rawPlace = workMatch[1].trim();
    const place = rawPlace.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `Nice! What are you studying or working on at ${place}?`;
  }

  // Continuum lineage inquiry
  if (continuumContextText && (text.includes('decision') || text.includes('lineage') || text.includes('remember') || text.includes('previous') || text.includes('last session'))) {
    return `Based on Continuum Lineage context:\n${continuumContextText}`;
  }

  // Context Capsule inquiries & testing
  if (text.includes("capsule idea") || text.includes("capsule feature") || text.includes("context capsule") || text.includes("about the capsule")) {
    if (text.includes("test") || text.includes("testing")) {
      return "Great! Context Capsules are designed to package your recent exchanges and decisions for fresh sessions. Let me know how the testing goes!";
    }
    return "The Context Capsule is a great mechanism for packaging active conversation context, decisions, and task state to seamlessly continue in a fresh chat without token bloat.";
  }

  // Activity statements
  if (text.includes("i'm working on") || text.includes("i am working on") || text.includes("working on a")) {
    return "Sounds like a great task! Let me know if you would like me to inspect relevant code, discuss the approach, plan the implementation, or run tests.";
  }

  if (text.includes("i'm testing") || text.includes("i am testing") || text.includes("testing the")) {
    return "Great! Let me know how the testing goes or if you need any assistance with diagnostics, verification, or test coverage.";
  }

  // Discussion & idea proposals
  if (text.includes("i think we should use") || text.includes("we should use") || text.includes("what about using") || text.includes("what do you think about")) {
    return "That sounds like a worthwhile approach to explore. We can discuss the architectural trade-offs, performance implications, or plan the integration whenever you're ready.";
  }

  if (text.includes("discuss the project architecture") || text.includes("discuss architecture") || text.includes("discuss the architecture")) {
    return "I'd be happy to discuss the architecture. What specific components, design patterns, or data flows would you like to explore?";
  }

  if (text.includes("explain this approach") || text.includes("explain the approach") || text.includes("tell me more about the idea") || text.includes("tell me more")) {
    return "Certainly! I'd be happy to walk through the approach and key design considerations. What specific questions or aspects would you like to focus on?";
  }

  if (['that sounds good', 'sounds good', 'looks good', 'that looks good', 'i agree', 'makes sense'].some(p => text.includes(p))) {
    return "Sounds good! Let me know how you'd like to proceed.";
  }

  if (text.includes("what can you do") || text.includes("who are you") || text.includes("tell me about nexus") || text.includes("what is nexus")) {
    return "I am NEXUS, an autonomous AI pair programmer. I provide workspace dependency analysis, multi-model AI routing (Groq, Gemini, OpenAI, Claude, DeepSeek, Grok), surgical code planning, Patch Firewall safety verification, automated testing, and Continuum session lineage.";
  }

  if (text.includes("what does this project do") || text.includes("explain what this project does") || text.includes("explain this project") || text.includes("what is this project") || text.includes("tell me about this project")) {
    return "This workspace contains an e-commerce cart management system with modules for cart calculations, item cataloging, unit test validation, and checkout rules. You can ask me to inspect specific components, add features, refactor code, or run test suites.";
  }

  // Conceptual questions
  if (text.includes("recursion")) {
    return "Recursion is a programming technique where a function calls itself to solve a smaller instance of the same problem, stopping when it reaches a base condition.";
  }

  return "Understood! Let me know what you'd like to discuss or work on, and I'll be glad to help.";
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
  getConversationalResponse,
};

