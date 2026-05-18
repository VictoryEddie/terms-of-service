import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { compareRateLimit } from "@/lib/ratelimit";
import { z } from "zod";

export const dynamic = "force-dynamic";

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
  let ip = cfConnectingIp || realIp || "127.0.0.1";
  
  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",")[0].trim();
  }
  
  const { success, limit, reset, remaining } = await compareRateLimit.limit(ip);

  if (!success) {
    return new Response(JSON.stringify({ 
      error: "Too many requests. You can perform 10 comparisons per hour.",
      retryAfter: reset 
    }), { 
      status: 429, 
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      } 
    });
  }

  try {
    // Validate request body
    const body = await req.json();
    const validationResult = compareRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid request data",
        details: validationResult.error.errors 
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { currentHash, previousHash } = validationResult.data;

    // 1. Fetch both versions from the Global Cache
    const [currentSnap, previousSnap] = await Promise.all([
      getDoc(doc(db, "global_cache", currentHash)),
      getDoc(doc(db, "global_cache", previousHash))
    ]);

    if (!currentSnap.exists() || !previousSnap.exists()) {
      throw new Error("One or both versions could not be found in the cache.");
    }

    const currentData = currentSnap.data();
    const previousData = previousSnap.data();

    // 2. AI COMPARISON (with Groq)
    async function callGroq(prompt: string, modelName: string) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY is missing.");

      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      let retries = 0;
      const maxRetries = 2;

      while (retries < maxRetries) {
        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: "system", content: "You are a legal comparison expert. Analyze changes between ToS versions. Return only valid JSON." },
                { role: "user", content: prompt }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            const status = response.status;
            
            console.error(`[AI] Groq ${modelName} HTTP ${status}:`, JSON.stringify(errorData, null, 2));
            
            if (status === 429) {
              const waitTime = (retries + 1) * 3000;
              console.log(`[AI] Quota hit (429). Retrying in ${waitTime}ms...`);
              await delay(waitTime);
              retries++;
              continue;
            }
            throw new Error(errorData.error?.message || `Groq API Failed with status ${status}`);
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          
          if (!text) throw new Error("Invalid response structure from Groq (Empty content)");

          // Robust JSON Sanitization
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const sanitizedText = jsonMatch ? jsonMatch[0] : text;

          return JSON.parse(sanitizedText);
        } catch (err: unknown) {
          const error = err as Error;
          if (error.message?.includes("429") && retries < maxRetries - 1) {
            retries++;
            continue;
          }
          throw err;
        }
      }
      throw new Error("Groq API failed after retries.");
    }

    const modelsToTry = [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768"
    ];

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
    for (const model of modelsToTry) {
      try {
        comparisonResult = await callGroq(prompt, model);
        if (comparisonResult) break;
      } catch {
        console.warn(`Comparison model ${model} failed, trying next...`);
      }
    }

    if (!comparisonResult) {
      throw new Error("All AI models failed to process the comparison.");
    }

    return new Response(JSON.stringify(comparisonResult), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Comparison Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
