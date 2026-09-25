import crypto from "crypto";

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "GROQ_API_KEY", pattern: /gsk_[A-Za-z0-9_\-]{20,}/g },
  { name: "UPSTASH_TOKEN", pattern: /UPSTASH_REDIS_REST_TOKEN[=:]\s*[A-Za-z0-9_\-]{10,}/g },
  { name: "FIREBASE_API_KEY", pattern: /AIza[A-Za-z0-9_\-]{25,}/g },
  { name: "FIREBASE_PRIVATE_KEY", pattern: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g },
  { name: "SENTRY_DSN", pattern: /https:\/\/[A-Za-z0-9]{16,}@sentry\.io\/\d+/g },
  { name: "BEARER_TOKEN", pattern: /Bearer\s+[A-Za-z0-9_\-\.]{12,}/gi },
  { name: "AUTHORIZATION_HEADER", pattern: /(authorization|api-key|x-api-key)(["'\s:=]+)[A-Za-z0-9_\-\.]{8,}/gi },
  { name: "PASSWORD", pattern: /(password|passwd|pwd|secret)(["'\s:=]+)[^\s"']{4,}/gi },
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const LONG_STRING_THRESHOLD = 1000;
const MAX_DEPTH = 6;

export function hashIp(ip: string | undefined | null): string {
  if (!ip) return "unknown";
  if (ip === "127.0.0.1" || ip === "::1") return "local";
  const normalized = ip.trim().split(",")[0].trim();
  return "ip_" + crypto.createHash("sha256").update(normalized + ":tos-analyser-ip-salt").digest("hex").slice(0, 12);
}

function truncateString(str: string, maxLen: number = LONG_STRING_THRESHOLD): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
}

function redactSecretsInString(str: string): string {
  let out = str;
  for (const { name, pattern } of SECRET_PATTERNS) {
    out = out.replace(pattern, `[REDACTED:${name}]`);
  }
  out = out.replace(EMAIL_PATTERN, "[REDACTED:EMAIL]");
  return out;
}

function redactValue<T>(value: T, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[REDACTED:MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const redacted = redactSecretsInString(value);
    return truncateString(redacted);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return {
      errorName: value.name,
      errorMessage: redactSecretsInString(truncateString(value.message || "")),
      errorStack: redactSecretsInString(truncateString(value.stack || "", 3000)),
    };
  }
  if (Array.isArray(value)) {
    const maxItems = 20;
    const shown = value.slice(0, maxItems).map((item) => redactValue(item, depth + 1));
    if (value.length > maxItems) shown.push(`[...${value.length - maxItems} more items]`);
    return shown;
  }
  if (typeof value === "object") {
    if (value instanceof Response || value instanceof Request) return "[REDACTED:FETCH_OBJECT]";
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>);
    for (const k of keys.slice(0, 100)) {
      out[k] = redactValue((value as Record<string, unknown>)[k], depth + 1);
    }
    if (keys.length > 100) out["__truncated_keys__"] = keys.length - 100;
    return out;
  }
  return "[REDACTED:UNSUPPORTED_TYPE]";
}

export function safeMessage(...args: unknown[]): unknown[] {
  return args.map((a) => redactValue(a, 0));
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV === "production") return;
    console.debug("[tos-debug]", ...safeMessage(...args));
  },
  info: (...args: unknown[]): void => {
    console.info("[tos-info]", ...safeMessage(...args));
  },
  warn: (...args: unknown[]): void => {
    console.warn("[tos-warn]", ...safeMessage(...args));
  },
  error: (...args: unknown[]): void => {
    console.error("[tos-error]", ...safeMessage(...args));
  },
};
