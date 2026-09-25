import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { compareRateLimit } from "@/lib/ratelimit";
import { logger, hashIp } from "@/lib/logging";
import { z } from "zod";

export const dynamic = "force-dynamic";

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
const compareRequestSchema = z.object({
  currentHash: z.string().min(1, "Current hash is required"),
  previousHash: z.string().min(1, "Previous hash is required"),
});

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

  // Never log or persist plaintext IPs (PII / GDPR)
  const rateLimitKey = hashIp(rawIp);

  const { success, limit, reset, remaining } =
    await compareRateLimit.limit(rateLimitKey);

  if (!success) {
    logger.warn("Compare rate limit exceeded", { rateLimitKey });
    return new Response(
      JSON.stringify({
        error: "Too many requests. You can perform 10 comparisons per hour.",
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
    // Validate request body
    const body = await req.json();
    const validationResult = compareRequestSchema.safeParse(body);

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

    const { currentHash, previousHash } = validationResult.data;

    // 1. Fetch both versions from the Global Cache
    const [currentSnap, previousSnap] = await Promise.all([
      getDoc(doc(db, "global_cache", currentHash)),
      getDoc(doc(db, "global_cache", previousHash)),
    ]);

    if (!currentSnap.exists() || !previousSnap.exists()) {
      throw new Error("One or both versions could not be found in the cache.");
    }

    const currentData = currentSnap.data();
    const previousData = previousSnap.data();

    // 2. AI COMPARISON (Multi-provider fallback: FREE-TIER LOCK-IN, 2026-09-25 VERIFIED)
    //    Provider lock-in: try providers in order, only advance after 2 consecutive failures.
    //    All models below verified LIVE + free-tier eligible (see analyze/route.ts for sources).
    type ProviderConfig = {
      name: string;
      baseUrl: string;
      apiKeyEnv: string;
      model: string;
    };

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
        name: "Mistral",
        baseUrl: "https://api.mistral.ai/v1/chat/completions",
        apiKeyEnv: "MISTRAL_API_KEY",
        model: "mistral-small-4",
      },
    ];

    async function callProvider(provider: ProviderConfig, prompt: string) {
      const apiKey = process.env[provider.apiKeyEnv];
      if (!apiKey)
        throw new Error(
          `${provider.apiKeyEnv} is missing in environment variables.`,
        );

      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
      logger.debug("Compare AI: attempting model", {
        provider: provider.name,
        model: provider.model,
      });

      const maxRetries = 1;
      for (let retries = 0; retries <= maxRetries; retries++) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          };

          const body = {
            model: provider.model,
            messages: [
              {
                role: "system",
                content:
                  "You are a legal comparison expert. Analyze changes between ToS versions. Return only valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          };

          const response = await fetch(provider.baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            let errorData: { error?: { message?: string } } = {};
            try {
              errorData = await response.json();
            } catch {}
            const status = response.status;

            logger.warn("Compare AI provider request failed", {
              provider: provider.name,
              model: provider.model,
              status,
              errorData,
            });

            if (status === 429 && retries < maxRetries) {
              const waitTime = 10000;
              logger.info("Compare AI provider quota hit, retrying once", {
                provider: provider.name,
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

          return JSON.parse(sanitizedText);
        } catch (err: unknown) {
          if (retries < maxRetries) continue;
          throw err;
        }
      }
      throw new Error(
        `${provider.name} (${provider.model}) failed after retries.`,
      );
    }

    let providerIndex = 0;
    let consecutiveFailures = 0;
    const PROVIDER_FAILURE_THRESHOLD = 2;

    function advanceProviderIfNeeded() {
      if (
        consecutiveFailures >= PROVIDER_FAILURE_THRESHOLD &&
        providerIndex < providers.length - 1
      ) {
        logger.warn(
          `Compare provider ${providers[providerIndex].name} failed ${consecutiveFailures}x in this run — falling back to ${providers[providerIndex + 1].name}.`,
        );
        providerIndex++;
        consecutiveFailures = 0;
      }
    }

    const prompt = `Compare these two versions of the Terms of Service for ${currentData.appName}.
      
      PREVIOUS VERSION SUMMARY:
      ${previousData.summary}
      
      CURRENT VERSION SUMMARY:
      ${currentData.summary}
      
      PREVIOUS RISKS:
      ${JSON.stringify(previousData.risks)}
      
      CURRENT RISKS:
      ${JSON.stringify(currentData.risks)}
      
      Identify specifically what has changed between these two versions. 
      Focus on Data Privacy, User Rights, and Liability.
      Did the app become more predatory or more transparent?
      
      Return as JSON with this schema:
      {
        "sentimentShift": "better" | "worse" | "neutral",
        "summary": "string",
        "majorChanges": [{ "type": "added"|"removed"|"modified", "impact": "high"|"medium"|"low", "title": "string", "description": "string" }],
        "verdict": "string"
      }`;

    let comparisonResult = null;
    while (providerIndex < providers.length && comparisonResult === null) {
      const provider = providers[providerIndex];
      try {
        comparisonResult = await callProvider(provider, prompt);
        if (comparisonResult) {
          logger.info("Compare AI provider succeeded", {
            provider: provider.name,
          });
          consecutiveFailures = 0;
          break;
        }
      } catch (e: unknown) {
        logger.warn("Comparison provider failed", {
          provider: provider.name,
          model: provider.model,
          message: (e as Error).message,
        });
        consecutiveFailures++;
        advanceProviderIfNeeded();
      }
    }

    if (!comparisonResult) {
      throw new Error("All AI models failed to process the comparison.");
    }

    const sanitizedResult = sanitizeAnalysisInput(comparisonResult);

    return new Response(JSON.stringify(sanitizedResult), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("Compare API request failed:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Comparison failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
