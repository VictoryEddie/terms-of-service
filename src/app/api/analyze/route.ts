import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { serverCache, type CachedAnalysisResult } from "@/lib/server-cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chunkText, createOverlappingChunks } from "@/lib/utils";
import { logger, hashIp } from "@/lib/logging";
import crypto from "crypto";
import dns from "dns";
import { promisify } from "util";
import { AnalysisResult, Risk, GoodPoint, SmokingGun } from "@/types/analysis";
import { z } from "zod";

import { analyzeRateLimit, deepAnalyzeRateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const dnsLookup = promisify(dns.lookup);

function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip.includes(":")) return true;
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return true;
  const octets = ipv4Match.slice(1).map(Number);
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c, d] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    a === 240 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

async function isSafeUrl(
  inputUrl: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return { ok: false, reason: "Invalid URL format." };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, reason: "Only http and https protocols are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname || hostname.length === 0) {
    return { ok: false, reason: "Hostname is required." };
  }

  const unsafeHostnamePatterns = [
    /^localhost$/i,
    /\.localhost$/i,
    /^local$/i,
    /\.local$/i,
    /\.internal$/i,
    /\.corp$/i,
    /^metadata\.google\.internal$/i,
  ];
  for (const pattern of unsafeHostnamePatterns) {
    if (pattern.test(hostname)) {
      return { ok: false, reason: "This hostname is not allowed." };
    }
  }

  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        ok: false,
        reason: "Private/reserved IP addresses are not allowed.",
      };
    }
  }

  if (hostname.includes("[")) {
    return { ok: false, reason: "IPv6 addresses are not allowed." };
  }

  if (!ipv4Match) {
    try {
      const resolved = await dnsLookup(hostname, { family: 4, all: true });
      if (resolved.length === 0) {
        return {
          ok: false,
          reason: "Hostname did not resolve to any IP address.",
        };
      }
      for (const entry of resolved) {
        if (isPrivateOrReservedIp(entry.address)) {
          return {
            ok: false,
            reason: "Hostname resolves to a disallowed private IP address.",
          };
        }
      }
    } catch {
      return {
        ok: false,
        reason:
          "Failed to resolve hostname. Please check the URL and try again.",
      };
    }
  }

  return { ok: true };
}

function sanitizeString(value: string): string {
  if (typeof value !== "string") return value;
  let out = value;
  out = out.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  out = out.replace(/<\s*\/?\s*iframe[^>]*>/gi, "");
  out = out.replace(/<\s*\/?\s*object[^>]*>/gi, "");
  out = out.replace(/<\s*\/?\s*embed[^>]*>/gi, "");
  out = out.replace(/<\s*\/?\s*style[^>]*>/gi, "");
  out = out.replace(/<\s*svg[^>]*>[\s\S]*?<\s*\/\s*svg\s*>/gi, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/vbscript\s*:/gi, "");
  out = out.replace(/data\s*:\s*text\/html/gi, "");
  out = out.replace(/on\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/on\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/on\w+\s*=\s*[^"'\s>]+/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  return out;
}

function sanitizeAnalysisInput<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value) as T;
  if (Array.isArray(value))
    return value.map((item) => sanitizeAnalysisInput(item)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeAnalysisInput(v);
    }
    return out as T;
  }
  return value;
}

// Input validation schema
const analyzeRequestSchema = z
  .object({
    text: z.string().optional(),
    url: z.string().url().optional(),
    force: z.boolean().optional(),
    deepAnalysis: z.boolean().optional(),
  })
  .refine((data) => data.text || data.url, {
    message: "Either 'text' or 'url' must be provided",
  });

// Type definitions for AI responses
interface ChunkAnalysisResult {
  risks?: Array<{ title: string; description: string; severity: string; quote: string }>;
  goodPoints?: Array<{ title: string; description: string }>;
}

interface FullAnalysisResult extends ChunkAnalysisResult {
  isTermsOfService?: boolean;
  appName?: string;
  transparencyScore?: number;
  grade?: string;
  summary?: string;
  jurisdiction?: string;
  smokingGun?: { title: string; description: string; clause: string };
}

export async function POST(req: Request) {
  // Rate limiting check - use multiple headers for better IP detection
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip"); // Cloudflare

  // Priority: CF > Real-IP > Forwarded-For > fallback
  // Take first IP from x-forwarded-for chain to prevent spoofing
  let rawIp = cfConnectingIp || realIp || "127.0.0.1";
  if (!rawIp && forwardedFor) {
    rawIp = forwardedFor.split(",")[0].trim();
  }

  // Never log or persist plaintext IPs (PII / GDPR). Hash with salt for pseudonymization.
  const rateLimitKey = hashIp(rawIp);

  // Parse request body once safely for rate limit check and payload validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const isDeepAnalysisRequest =
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).deepAnalysis === true;

  // Apply appropriate rate limit based on analysis mode
  const rateLimit = isDeepAnalysisRequest ? deepAnalyzeRateLimit : analyzeRateLimit;
  const { success, limit, reset, remaining } = await rateLimit.limit(rateLimitKey);

  if (!success) {
    logger.warn("Rate limit exceeded for requester", { rateLimitKey, mode: isDeepAnalysisRequest ? 'deep' : 'quick' });
    return new Response(
      JSON.stringify({
        error: isDeepAnalysisRequest 
          ? "Too many requests. You can perform 2 deep analyses per hour."
          : "Too many requests. You can perform 5 analyses per hour.",
        retryAfter: reset,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  }

  try {
    // Validate parsed request body
    const validationResult = analyzeRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { text, url, force, deepAnalysis } = validationResult.data;
    let contentToAnalyze = text || "";

    if (url) {
      const urlSafety = await isSafeUrl(url);
      if (!urlSafety.ok) {
        throw new Error(urlSafety.reason);
      }
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "manual",
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("Location");
          if (location) {
            const redirectSafety = await isSafeUrl(location);
            if (!redirectSafety.ok) {
              throw new Error("Redirect points to a disallowed URL.");
            }
          }
        }
        const html = await response.text();
        contentToAnalyze = html
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      } catch (e) {
        const err = e as Error;
        throw new Error(
          err.message || "Could not fetch the content from this URL.",
        );
      }
    }

    if (!contentToAnalyze.trim()) throw new Error("No content to analyze.");

    const contentHash = crypto
      .createHash("sha256")
      .update(contentToAnalyze)
      .digest("hex");

    // 1. HYBRID CACHE CHECK (Memory + Redis) - Skip if force is true
    if (!force) {
      const cacheHit = await serverCache.get(contentHash);
      if (cacheHit)
        return new Response(JSON.stringify({ ...cacheHit, isCached: true }), {
          headers: { "Content-Type": "application/json" },
        });

      // 2. FIRESTORE CHECK (Server-Side Admin SDK for zero-latency, reliable reads)
      try {
        const adminFs = getAdminFirestore();
        if (adminFs) {
          const docSnap = await adminFs.collection("global_cache").doc(contentHash).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            const cachedResult = data as CachedAnalysisResult;
            await serverCache.set(contentHash, cachedResult);
            logger.info("L3 (Firestore) server-side cache HIT", { contentHash });
            return new Response(
              JSON.stringify({ ...cachedResult, isCached: true }),
              { headers: { "Content-Type": "application/json" } },
            );
          }
        } else {
          // Fallback to client SDK only if Admin SDK credentials are not configured
          const cacheRef = doc(db, "global_cache", contentHash);
          const cachedDoc = await getDoc(cacheRef);
          if (cachedDoc && cachedDoc.exists()) {
            const data = cachedDoc.data();
            const cachedResult = data as CachedAnalysisResult;
            await serverCache.set(contentHash, cachedResult);
            return new Response(
              JSON.stringify({ ...cachedResult, isCached: true }),
              { headers: { "Content-Type": "application/json" } },
            );
          }
        }
      } catch (error) {
        logger.warn(
          "Firestore cache check failed, proceeding with fresh analysis:",
          error,
        );
        // Continue to AI analysis instead of failing
      }
    }

    // 3. AI ANALYSIS (Recursive Chunking) — Multi-provider fallback
    //    PROVIDER LOCK-IN: Pick ONE provider at the start of the analysis run and use
    //    it for EVERY chunk + the Synthesis step. Only fall back to the NEXT provider if
    //    the current provider fails 2 consecutive times in this run. Chunks run
    //    SEQUENTIALLY (not in parallel) with a small gap to avoid free-tier burst 429s.
    type ProviderConfig = {
      name: string;
      baseUrl: string;
      apiKeyEnv: string;
      model: string;
      extraHeaders?: Record<string, string>;
      extraBody?: Record<string, unknown>;
    };

    // Verified resilient multi-tier LLM fallback hierarchy:
    // 1. Gemini (Primary)       — High throughput, 1M context, reliable free tier
    // 2. Groq-120B & 20B        — Fast secondary inference
    // 3. OpenRouter             — Multi-provider free open-weight fallback (Llama 3.3 70B)
    // 4. Cohere                 — Legal/document analysis trial tier (Command-R)
    const providers: ProviderConfig[] = [
      {
        name: "Gemini",
        baseUrl:
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKeyEnv: "GEMINI_API_KEY",
        model: "gemini-3.5-flash-lite",
      },
      {
        name: "Groq-120B",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        apiKeyEnv: "GROQ_API_KEY",
        model: "openai/gpt-oss-120b",
      },
      {
        name: "Groq-20B",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        apiKeyEnv: "GROQ_API_KEY",
        model: "openai/gpt-oss-20b",
      },
      {
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        apiKeyEnv: "OPENROUTER_API_KEY",
        model: "meta-llama/llama-3.3-70b-instruct:free",
        extraHeaders: {
          "HTTP-Referer": "https://tos-analyser.vercel.app",
          "X-Title": "Terms Of Service Risk Analyzer",
        },
      },
      {
        name: "Cohere",
        baseUrl: "https://api.cohere.ai/compatibility/v1/chat/completions",
        apiKeyEnv: "COHERE_API_KEY",
        model: "command-r",
      },
    ];

    async function callProvider(provider: ProviderConfig, prompt: string) {
      const apiKey = process.env[provider.apiKeyEnv];
      if (!apiKey) {
        logger.warn(`${provider.apiKeyEnv} is missing in environment variables.`);
        throw new Error(
          `${provider.apiKeyEnv} is missing in environment variables.`,
        );
      }

      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
      logger.debug("AI: attempting model", {
        provider: provider.name,
        model: provider.model,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey.substring(0, 10) + '...',
      });

      const maxRetries = 1;
      for (let retries = 0; retries <= maxRetries; retries++) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(provider.extraHeaders || {}),
          };

          const body = {
            model: provider.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert legal document analyzer. Your task is to analyze Terms of Service documents for risks, predatory clauses, and transparency. You MUST return your analysis in raw JSON format matching the schema provided. Do not include any preamble or markdown tags.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
            ...(provider.extraBody || {}),
          };

          const response = await fetch(provider.baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(45000), // 45 second timeout per request (increased for deep analysis)
          }).catch((fetchError) => {
            // Handle network-level errors (DNS, timeout, connection refused, etc.)
            logger.error("Network fetch error", {
              provider: provider.name,
              baseUrl: provider.baseUrl,
              error: fetchError.message,
              code: fetchError.code,
              name: fetchError.name,
            });
            throw new Error(`Network error for ${provider.name}: ${fetchError.message}`);
          });

          if (!response.ok) {
            let errorData: { error?: { message?: string } } = {};
            try {
              errorData = await response.json();
            } catch {}
            const status = response.status;

            logger.warn("AI provider request failed", {
              provider: provider.name,
              model: provider.model,
              status,
              errorData,
            });

            if (status === 429 && retries < maxRetries) {
              let waitTime = 10000;
              const msg = errorData.error?.message || "";
              const match = msg.match(/try again in ([\d\.]+)s/i);
              if (match && match[1]) {
                waitTime = Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 500, 15000);
              }
              logger.info("AI provider quota hit, retrying once", {
                provider: provider.name,
                model: provider.model,
                waitMs: waitTime,
              });
              await delay(waitTime);
              continue;
            }
            throw new Error(
              errorData.error?.message ||
                `${provider.name} API Failed with status ${status}`,
            );
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;

          if (!text)
            throw new Error(
              `Invalid response structure from ${provider.name} (Empty content)`,
            );

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const sanitizedText = jsonMatch ? jsonMatch[0] : text;

          try {
            return JSON.parse(sanitizedText);
          } catch {
            logger.warn("AI provider JSON parse failed, raw snippet follows:", {
              provider: provider.name,
              snippet: text.substring(0, 500),
            });
            throw new Error("Failed to parse AI response as valid JSON.");
          }
        } catch (err: unknown) {
          const error = err as Error & { cause?: Error; code?: string };
          logger.error("Provider call attempt failed", {
            provider: provider.name,
            model: provider.model,
            retryAttempt: retries,
            errorMessage: error.message,
            errorCode: error.code,
            errorCause: error.cause?.message,
            errorStack: error.stack?.split('\n')[0], // First line only
          });
          if (retries < maxRetries) continue;
          throw err;
        }
      }
      throw new Error(
        `${provider.name} (${provider.model}) failed after retries.`,
      );
    }

    let finalObject: AnalysisResult | null = null;

    // Pick the first available provider at run start and stick with it.
    // Move to the next provider ONLY after 2 consecutive failures in this run.
    let providerIndex = 0;
    let consecutiveFailures = 0;
    const PROVIDER_FAILURE_THRESHOLD = 2;

    function advanceProviderIfNeeded() {
      if (
        consecutiveFailures >= PROVIDER_FAILURE_THRESHOLD &&
        providerIndex < providers.length - 1
      ) {
        logger.warn(
          `Provider ${providers[providerIndex].name} failed ${consecutiveFailures}x in this run — falling back to ${providers[providerIndex + 1].name} for remaining work.`,
        );
        providerIndex++;
        consecutiveFailures = 0;
      }
    }

    async function callWithLockIn(
      prompt: string,
      stage: string,
    ): Promise<ChunkAnalysisResult | FullAnalysisResult | null> {
      while (providerIndex < providers.length) {
        const provider = providers[providerIndex];
        try {
          logger.debug(`AI: ${stage} trying provider (locked-in)`, {
            provider: provider.name,
            model: provider.model,
          });
          const result = await callProvider(provider, prompt);
          if (result) {
            consecutiveFailures = 0;
            return result;
          }
        } catch (e: unknown) {
          const msg = (e as Error).message;
          logger.warn(`${stage} provider failed`, {
            provider: provider.name,
            model: provider.model,
            message: msg,
          });
          consecutiveFailures++;
          advanceProviderIfNeeded();
          if (providerIndex >= providers.length) break;
          continue;
        }
        // Empty result without throwing — treat as a single failure, loop
        consecutiveFailures++;
        advanceProviderIfNeeded();
      }
      return null;
    }

    // Per-chunk throttling (750ms–1.25s, random jitter) between sequential calls
    // to avoid hitting any free-tier per-second/burst rate limits.
    const MIN_CHUNK_DELAY_MS = 750;
    const JITTER_DELAY_MS = 500;

    // DEEP ANALYSIS MODE: Multi-pass analysis with 6 specialized passes
    if (deepAnalysis) {
      logger.info("Starting DEEP ANALYSIS mode with 6-pass system", {
        contentLength: contentToAnalyze.length,
        wordCount: contentToAnalyze.split(/\s+/).length,
      });

      const deepAnalysisPasses = [
        {
          name: "Data Privacy & Tracking",
          prompt: (text: string) => `You are a privacy law expert. Analyze ONLY data collection, storage, sharing, and user privacy rights in this Terms of Service.

Focus on:
- Personal data collected
- Third-party sharing
- Tracking technologies
- Data retention periods
- Right to deletion/access
- GDPR/CCPA compliance gaps

Flag any ambiguous data usage clauses, unlimited retention periods, or broad third-party sharing.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
        {
          name: "Liability & Indemnification",
          prompt: (text: string) => `You are a contract lawyer. Analyze ONLY liability limitations, warranties, and indemnification in this Terms of Service.

Focus on:
- Company liability caps
- "As-is" disclaimers
- User indemnification clauses
- Warranty exclusions
- Force majeure abuse

Flag any clauses where users bear unreasonable legal or financial risk for company actions.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
        {
          name: "User Rights & Account Control",
          prompt: (text: string) => `You are a consumer rights advocate. Analyze ONLY account control, termination rights, and user recourse in this Terms of Service.

Focus on:
- Account termination policies
- Content deletion rights
- Service changes without notice
- Right to appeal/dispute
- Unilateral modifications

Flag any unilateral power imbalances favoring the company.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
        {
          name: "Payment & Subscription Terms",
          prompt: (text: string) => `You are a financial compliance auditor. Analyze ONLY payment, billing, refunds, and subscriptions in this Terms of Service.

Focus on:
- Auto-renewal policies
- Refund policies
- Price change notifications
- Cancellation difficulty
- Hidden fees

Flag any predatory billing practices, unclear cancellation terms, or no-refund policies.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
        {
          name: "Content Ownership & Licensing",
          prompt: (text: string) => `You are an intellectual property lawyer. Analyze ONLY content ownership, licensing, and usage rights in this Terms of Service.

Focus on:
- User-generated content ownership
- License grants to company
- Sublicensing to third parties
- Copyright/IP disputes
- Perpetual licenses

Flag any perpetual licenses, broad sublicensing rights, or content ownership transfers.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
        {
          name: "Dispute Resolution & Jurisdiction",
          prompt: (text: string) => `You are a litigation attorney. Analyze ONLY dispute resolution, arbitration, governing law, and legal recourse in this Terms of Service.

Focus on:
- Forced arbitration clauses
- Class action waivers
- Jurisdiction requirements
- Legal fee responsibility
- Statute of limitations

Flag any forced arbitration, class action bans, or inconvenient jurisdictions.

Text: ${text}

JSON Schema:
{
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`,
        },
      ];

      // Create overlapping chunks for long documents
      const deepChunks = createOverlappingChunks(contentToAnalyze, 3000, 200);
      const allPassResults: ChunkAnalysisResult[] = [];

      // For each chunk, run all 6 passes
      for (let chunkIdx = 0; chunkIdx < deepChunks.length; chunkIdx++) {
        const chunk = deepChunks[chunkIdx];
        const chunkLabel = deepChunks.length > 1 ? ` (Chunk ${chunkIdx + 1}/${deepChunks.length})` : "";

        for (let passIdx = 0; passIdx < deepAnalysisPasses.length; passIdx++) {
          const pass = deepAnalysisPasses[passIdx];
          const passLabel = `Pass ${passIdx + 1}/6: ${pass.name}${chunkLabel}`;

          logger.info(`Deep Analysis - ${passLabel}`, {
            provider: providers[providerIndex].name,
          });

          const passResult = await callWithLockIn(pass.prompt(chunk), passLabel);
          if (passResult) {
            allPassResults.push(passResult);
            logger.info(`${passLabel} COMPLETE`, {
              risks: passResult.risks?.length || 0,
              goodPoints: passResult.goodPoints?.length || 0,
            });
          } else {
            logger.warn(`${passLabel} FAILED - skipping`, { chunkIdx, passIdx });
          }

          // Throttle between passes
          if (passIdx < deepAnalysisPasses.length - 1 || chunkIdx < deepChunks.length - 1) {
            const waitMs = MIN_CHUNK_DELAY_MS + Math.floor(Math.random() * (JITTER_DELAY_MS + 1));
            await new Promise((res) => setTimeout(res, waitMs));
          }
        }
      }

      // Synthesis: Merge and deduplicate all pass results
      if (allPassResults.length === 0) {
        logger.error("Deep Analysis failed - no passes completed successfully", {
          chunksAttempted: deepChunks.length,
          passesAttempted: deepAnalysisPasses.length,
        });
        throw new Error(
          "Deep analysis could not complete any passes. This may be due to API rate limits or network issues. Please try again in a few minutes, or use Quick Analysis mode."
        );
      }

      logger.info("Deep Analysis passes complete, starting synthesis", {
        successfulPasses: allPassResults.length,
        expectedPasses: deepChunks.length * deepAnalysisPasses.length,
      });

      const synthesisPrompt = `I have analyzed a Terms of Service document through 6 specialized legal passes (Data Privacy, Liability, User Rights, Payment, Content Ownership, Dispute Resolution).

Here are all the extracted risks and good points from all passes:

${JSON.stringify(allPassResults)}

Your task:
1. Synthesize these into one comprehensive master report
2. Remove duplicate or near-duplicate findings
3. If the same clause was flagged by multiple passes, increase its severity
4. Select the most critical "Smoking Gun" clause
5. Provide a final grade (A-F) and executive summary

JSON Schema:
{
  "isTermsOfService": true,
  "appName": string,
  "transparencyScore": number,
  "grade": "A"|"B"|"C"|"D"|"F",
  "summary": string,
  "jurisdiction": string,
  "smokingGun": { "title": string, "description": string, "clause": string },
  "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
  "goodPoints": [{ "title": string, "description": string }]
}`;

      finalObject = (await callWithLockIn(synthesisPrompt, "Deep Synthesis")) as AnalysisResult | null;

      if (finalObject) {
        logger.info("Deep Analysis COMPLETE", {
          passesRun: allPassResults.length,
          totalRisks: finalObject.risks?.length || 0,
          grade: finalObject.grade,
        });
      }
    } else {
      // QUICK ANALYSIS MODE (existing logic)
      const chunks = chunkText(contentToAnalyze);

    if (chunks.length === 1) {
      const prompt = `Critically analyze these Terms of Service. Provide a full and detailed audit.
      Text: ${chunks[0]}
      
      JSON Schema:
      {
        "isTermsOfService": boolean,
        "appName": string,
        "transparencyScore": number,
        "grade": "A"|"B"|"C"|"D"|"F",
        "summary": string,
        "jurisdiction": string,
        "smokingGun": { "title": string, "description": string, "clause": string },
        "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
        "goodPoints": [{ "title": string, "description": string }]
      }`;

      finalObject = (await callWithLockIn(
        prompt,
        "Single-pass",
      )) as AnalysisResult | null;
    } else {
      logger.info("AI analysis: processing multi-chunk document (SEQUENTIAL)", {
        chunkCount: chunks.length,
        interChunkDelayMs: `${MIN_CHUNK_DELAY_MS}-${MIN_CHUNK_DELAY_MS + JITTER_DELAY_MS}`,
      });
      const partialResults: ChunkAnalysisResult[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const prompt = `Analyze this SECTION (${i + 1}/${chunks.length}) of a Terms of Service document. Extract all risks and good points.
        Text: ${chunks[i]}
        
        JSON Schema:
        {
          "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
          "goodPoints": [{ "title": string, "description": string }]
        }`;

        const chunkResult = await callWithLockIn(prompt, `Chunk-${i + 1}`);
        if (chunkResult) {
          partialResults.push(chunkResult);
          logger.info(`Chunk ${i + 1}/${chunks.length} COMPLETE`, {
            provider: providers[providerIndex].name,
            risks: chunkResult.risks?.length || 0,
            goodPoints: chunkResult.goodPoints?.length || 0,
          });
        } else {
          logger.warn("Chunk failed ALL providers, skipping", {
            chunkIndex: i,
          });
        }

        // Throttle between chunks to avoid free-tier burst throttling.
        if (i < chunks.length - 1) {
          const waitMs =
            MIN_CHUNK_DELAY_MS +
            Math.floor(Math.random() * (JITTER_DELAY_MS + 1));
          logger.debug(
            `Sequential throttle: waiting ${waitMs}ms before next chunk…`,
          );
          await new Promise((res) => setTimeout(res, waitMs));
        }
      }

      const synthesisPrompt = `I have analyzed a long Terms of Service in parts. Here are all the extracted risks and good points. 
      Synthesize them into one master report. 
      Remove duplicates. Select the most critical "Smoking Gun" clause. 
      Provide a final grade and summary.
      
      Data: ${JSON.stringify(partialResults)}
      
      JSON Schema:
      {
        "isTermsOfService": true,
        "appName": string,
        "transparencyScore": number,
        "grade": "A"|"B"|"C"|"D"|"F",
        "summary": string,
        "jurisdiction": string,
        "smokingGun": { "title": string, "description": string, "clause": string },
        "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
        "goodPoints": [{ "title": string, "description": string }]
      }`;

      finalObject = (await callWithLockIn(
        synthesisPrompt,
        "Synthesis",
      )) as AnalysisResult | null;
    }
    } // End of QUICK ANALYSIS MODE (else block)

    if (!finalObject) {
      throw new Error("Analysis failed to generate a result.");
    }
    const wordCount = contentToAnalyze.split(/\s+/).length;
    // Attach calculated time saved and source info
    let finalResult: CachedAnalysisResult = {
      ...finalObject,
      timeSavedMinutes: Math.max(1, Math.round(wordCount / 200)),
      contentHash,
      analysisSource: url ? "link" : "text",
      sourceUrl: url || null,
    };

    // Sanitize ALL AI-generated string fields defensively before caching/sending.
    // Prevents XSS if an attacker-controlled source document / prompt injection
    // introduces HTML, event handlers, or javascript: URLs into the output.
    finalResult = sanitizeAnalysisInput(finalResult);

    // 4. SAVE TO 3-TIER CACHE
    //    L1: In-Memory LRU (synchronous, ultra-fast)
    //    L2: Upstash Redis (persistent, 7-day TTL)
    //    L3: Firestore global_cache (via Firebase Admin SDK, respects server trust)
    if (finalObject.isTermsOfService) {
      await serverCache.set(contentHash, finalResult);

      try {
        const adminFs = getAdminFirestore();
        if (!adminFs) {
          logger.warn(
            "L3 (Firestore) cache SKIPPED — Admin SDK not initialized. " +
              "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_PROJECT_ID + " +
              "FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in .env.local " +
              "to persist cache writes to Firestore.",
          );
        } else {
          const risks = Array.isArray(finalResult.risks)
            ? (finalResult.risks as Risk[])
            : [];
          const goodPoints = Array.isArray(finalResult.goodPoints)
            ? (finalResult.goodPoints as GoodPoint[])
            : [];
          const smokingGun = finalResult.smokingGun
            ? (finalResult.smokingGun as SmokingGun)
            : null;

          await adminFs
            .collection("global_cache")
            .doc(contentHash)
            .set(
              {
                appName: finalResult.appName ?? "Unknown",
                grade: finalResult.grade ?? "C",
                summary: finalResult.summary,
                contentHash,
                isTermsOfService: true,
                transparencyScore: finalResult.transparencyScore ?? 0,
                jurisdiction: finalResult.jurisdiction ?? "Unknown",
                timeSavedMinutes: finalResult.timeSavedMinutes ?? 0,
                analysisSource: finalResult.analysisSource ?? "text",
                sourceUrl: finalResult.sourceUrl ?? "",
                risks,
                goodPoints,
                smokingGun,
                cachedAt: new Date(),
              },
              { merge: true },
            );
          logger.info("L3 (Firestore) cache saved successfully.", {
            appName: finalResult.appName,
            contentHash: contentHash.slice(0, 12) + "…",
          });
        }
      } catch (err) {
        logger.warn(
          "Firestore L3 cache write failed (non-fatal, L1+L2 OK):",
          err,
        );
      }
    }

    return new Response(JSON.stringify(finalResult), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error & {
      status?: number;
      statusCode?: number;
      data?: unknown;
    };
    logger.error("Analyze API request failed:", {
      message: error.message,
      status: error.status || error.statusCode,
      data: error.data,
    });

    const isQuotaError = error.status === 429 || error.message?.includes("429");
    const errorMessage = isQuotaError
      ? "AI Limit Reached. Our AI processing quota has been exceeded for the moment. Please wait a minute and try again."
      : error.message || "An unexpected error occurred during analysis.";

    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: error.status || 500,
      }),
      {
        status: error.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
