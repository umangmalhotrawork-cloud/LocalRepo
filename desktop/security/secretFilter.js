/**
 * Secret Redaction Filter
 * Deterministic security boundary module that detects and sanitizes sensitive materials
 * (API keys, tokens, passwords, database URIs, private keys, .env secrets)
 * from Continuum snapshots and text context payloads.
 */

const SECRET_PATTERNS = [
  // Gemini API Key
  {
    type: "GEMINI_API_KEY",
    regex: /(?:GEMINI_API_KEY\s*[:=]\s*['"]?|AIza|AQ\.)[A-Za-z0-9_-]{10,70}['"]?/gi,
  },
  // Groq API Key
  {
    type: "GROQ_API_KEY",
    regex: /(?:GROQ_API_KEY\s*[:=]\s*['"]?|gsk_)[A-Za-z0-9_-]{15,60}['"]?/gi,
  },
  // OpenAI API Key
  {
    type: "OPENAI_API_KEY",
    regex: /(?:OPENAI_API_KEY\s*[:=]\s*['"]?|sk-[A-Za-z0-9_-]{15,50})['"]?/gi,
  },
  // Anthropic / Claude API Key
  {
    type: "CLAUDE_API_KEY",
    regex: /(?:ANTHROPIC_API_KEY|CLAUDE_API_KEY)\s*[:=]\s*['"]?[A-Za-z0-9_-]{15,60}['"]?|sk-ant-[A-Za-z0-9_-]{15,60}/gi,
  },
  // xAI Grok API Key
  {
    type: "GROK_API_KEY",
    regex: /(?:XAI_API_KEY|GROK_API_KEY)\s*[:=]\s*['"]?[A-Za-z0-9_-]{15,60}['"]?|xai-[A-Za-z0-9_-]{15,60}/gi,
  },
  // NVIDIA / NVAPI Key
  {
    type: "NVIDIA_API_KEY",
    regex: /(?:NVAPI_API_KEY|NVIDIA_API_KEY)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?|nvapi-[A-Za-z0-9_-]{32,}/gi,
  },
  // GitHub Tokens (ghp, gho, ghu, ghs, ghr, github_pat)
  {
    type: "GITHUB_TOKEN",
    regex: /(?:gh[pousr]_[A-Za-z0-9]{36,40}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})/g,
  },
  // AWS Access Key ID & Secret Key
  {
    type: "AWS_CREDENTIAL",
    regex: /(?:AKIA[0-9A-Z]{16}|aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9\/+=]{40}['"]?)/gi,
  },
  // Bearer Token
  {
    type: "BEARER_TOKEN",
    regex: /Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/g,
  },
  // JSON Web Token (JWT)
  {
    type: "JWT_TOKEN",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  // Database Connection URIs (MongoDB, PostgreSQL, MySQL)
  {
    type: "DATABASE_URI",
    regex: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^:\s]+:[^@\s]+@[^\s"']+/gi,
  },
  // Private Key Blocks
  {
    type: "PRIVATE_KEY",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g,
  },
  // Explicit Password assignments (e.g. password = "mysecretpassword123")
  {
    type: "PASSWORD",
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s,;]{4,}['"]?/gi,
  },
  // Explicit Secret assignments (e.g. secret_key = "super_secret_val")
  {
    type: "SECRET",
    regex: /(?:secret_key|api_secret|client_secret)\s*[:=]\s*['"]?[^'"\s,;]{4,}['"]?/gi,
  },
];

// RegEx matching .env file lines with sensitive keys
const ENV_SECRET_LINE_REGEX = /^(?:[A-Z0-9_]*(?:SECRET|PASSWORD|PASS|TOKEN|KEY|CREDENTIAL|AUTH|PRIVATE)[A-Z0-9_]*)\s*=\s*.+$/gim;

/**
 * Sanitizes a single string by redacting known secret patterns.
 * Preserves normal source code and standard configuration values.
 */
function sanitizeString(text) {
  if (typeof text !== "string" || !text) return text;
  let sanitized = text;

  // 1. Check for multi-line .env content
  sanitized = sanitized.replace(ENV_SECRET_LINE_REGEX, (line) => {
    const parts = line.split("=");
    const key = parts[0].trim();
    return `${key}=[REDACTED_SECRET:ENV_VAR]`;
  });

  // 2. Apply pattern match replacements
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, `[REDACTED_SECRET:${pattern.type}]`);
  }

  return sanitized;
}

/**
 * Recursively sanitizes objects, arrays, and primitive strings.
 * Returns a new sanitized object structure without mutating the original input.
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const result = {};
  for (const key of Object.keys(obj)) {
    const keyLower = key.toLowerCase();
    // If object property key explicitly indicates a secret key name, redact value directly
    if (
      keyLower.includes("secret") ||
      keyLower.includes("apikey") ||
      keyLower.includes("api_key") ||
      keyLower.includes("password") ||
      keyLower.includes("privatekey") ||
      keyLower.includes("private_key")
    ) {
      if (typeof obj[key] === "string" && obj[key].length > 0) {
        result[key] = `[REDACTED_SECRET:${key.toUpperCase()}]`;
      } else {
        result[key] = sanitizeObject(obj[key]);
      }
    } else {
      result[key] = sanitizeObject(obj[key]);
    }
  }

  return result;
}

/**
 * Universal sanitize wrapper accepting any string, object, array, or primitive value.
 */
function sanitize(value) {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  return sanitizeObject(value);
}

module.exports = {
  sanitize,
  sanitizeString,
  sanitizeObject,
};
