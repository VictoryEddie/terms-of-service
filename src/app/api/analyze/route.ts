import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { serverCache, type CachedAnalysisResult } from "@/lib/server-cache";
import { chunkText } from "@/lib/utils";
import crypto from "crypto";
import { AnalysisResult } from "@/types/analysis";
import { z } from "zod";

import { analyzeRateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Input validation schema
const analyzeRequestSchema = z.object({
  text: z.string().optional(),
  url: z.string().url().optional(),
  force: z.boolean().optional(),
}).refine(
  (data) => data.text || data.url,
  { message: "Either 'text' or 'url' must be provided" }
);

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
  
  const { success, limit, reset, remaining } = await analyzeRateLimit.limit(ip);

  if (!success) {
    return new Response(JSON.stringify({ 
      error: "Too many requests. You can perform 5 analyses per hour.",
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
    const validationResult = analyzeRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid request data",
        details: validationResult.error.errors 
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { text, url, force } = validationResult.data;
    let contentToAnalyze = text || "";

    if (url) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });
        const html = await response.text();
        contentToAnalyze = html
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      } catch {
        throw new Error("Could not fetch the content from this URL.");
      }
    }

    if (!contentToAnalyze.trim()) throw new Error("No content to analyze.");

    const contentHash = crypto.createHash("sha256").update(contentToAnalyze).digest("hex");

    // 1. HYBRID CACHE CHECK (Memory + Redis) - Skip if force is true
    if (!force) {
      const cacheHit = await serverCache.get(contentHash);
      if (cacheHit) return new Response(JSON.stringify({ ...cacheHit, isCached: true }), { headers: { "Content-Type": "application/json" } });

      // 2. FIRESTORE CHECK (Read-only)
      const cacheRef = doc(db, "global_cache", contentHash);
      try {
        const cachedDoc = await Promise.race([
          getDoc(cacheRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
        ]) as Awaited<ReturnType<typeof getDoc>>;

        if (cachedDoc && cachedDoc.exists()) {
          const data = cachedDoc.data();
          // Type assertion: Firestore data matches CachedAnalysisResult structure
          const cachedResult = data as CachedAnalysisResult;
          serverCache.set(contentHash, cachedResult);
          return new Response(JSON.stringify({ ...cachedResult, isCached: true }), { headers: { "Content-Type": "application/json" } });
        }
      } catch (error) {
        console.warn("Firestore cache check failed, proceeding with fresh analysis:", error);
        // Continue to AI analysis instead of failing
      }
    }

    // 3. AI ANALYSIS (Recursive Chunking)
    async function callGroq(prompt: string, modelName: string) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY is missing in environment variables.");

      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      console.log(`[AI] Attempting ${modelName}...`);
      
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
                { 
                  role: "system", 
                  content: "You are an expert legal document analyzer. Your task is to analyze Terms of Service documents for risks, predatory clauses, and transparency. You MUST return your analysis in raw JSON format matching the schema provided. Do not include any preamble or markdown tags." 
                },
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

          try {
            return JSON.parse(sanitizedText);
          } catch {
            console.error(`[AI] Failed to parse Groq JSON. Raw snippet:`, text.substring(0, 500));
            throw new Error("Failed to parse AI response as valid JSON.");
          }
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

    const chunks = chunkText(contentToAnalyze);
    let finalObject: AnalysisResult | null = null;

    // Define Groq models in order of capability
    const modelsToTry = [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768"
    ];

    if (chunks.length === 1) {
      // Single pass analysis
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

      for (const model of modelsToTry) {
        try {
          finalObject = await callGroq(prompt, model);
          if (finalObject) break;
        } catch (e: unknown) {
          console.warn(`Model ${model} failed: ${(e as Error).message}`);
          continue;
        }
      }
    } else {
      // Multi-pass (Map-Reduce)
      console.log(`Processing ${chunks.length} chunks...`);
      const partialResults = [];

      for (let i = 0; i < chunks.length; i++) {
        const prompt = `Analyze this SECTION (${i+1}/${chunks.length}) of a Terms of Service document. Extract all risks and good points.
        Text: ${chunks[i]}
        
        JSON Schema:
        {
          "risks": [{ "title": string, "description": string, "severity": "high"|"medium"|"low", "quote": string }],
          "goodPoints": [{ "title": string, "description": string }]
        }`;
        
        let chunkResult = null;
        for (const model of modelsToTry) {
          try {
            chunkResult = await callGroq(prompt, model);
            if (chunkResult) break;
          } catch (e: unknown) {
            console.warn(`Model ${model} for chunk ${i} failed: ${(e as Error).message}`);
          }
        }
        
        if (chunkResult) {
          partialResults.push(chunkResult);
        } else {
          console.warn(`Chunk ${i} failed all models, skipping...`);
        }
      }

      // Final Synthesis (Reduce)
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

      for (const model of modelsToTry) {
        try {
          finalObject = await callGroq(synthesisPrompt, model);
          if (finalObject) break;
        } catch (e: unknown) {
          console.warn(`Model ${model} for synthesis failed: ${(e as Error).message}`);
        }
      }
    }

    if (!finalObject) {
      throw new Error("Analysis failed to generate a result.");
    }
    const wordCount = contentToAnalyze.split(/\s+/).length;
    // Attach calculated time saved and source info
    const finalResult: CachedAnalysisResult = { 
      ...finalObject, 
      timeSavedMinutes: Math.max(1, Math.round(wordCount / 200)), 
      contentHash,
      analysisSource: url ? "link" : "text",
      sourceUrl: url || null
    };

    // 4. SAVE TO CACHE & FIRESTORE
    if (finalObject.isTermsOfService) {
      await serverCache.set(contentHash, finalResult);
      
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      
      // Use the Firestore REST API for a clean, stateless POST
      // We send the full finalResult object now for better sharing support
      fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/global_cache/${contentHash}?key=${apiKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            appName: { stringValue: finalResult.appName || "Unknown" },
            grade: { stringValue: finalResult.grade || "C" },
            summary: { stringValue: finalResult.summary },
            contentHash: { stringValue: contentHash },
            isTermsOfService: { booleanValue: true },
            transparencyScore: { integerValue: finalResult.transparencyScore },
            jurisdiction: { stringValue: finalResult.jurisdiction || "Unknown" },
            timeSavedMinutes: { integerValue: finalResult.timeSavedMinutes },
            analysisSource: { stringValue: finalResult.analysisSource },
            sourceUrl: { stringValue: finalResult.sourceUrl || "" },
            // Store arrays as JSON strings to avoid complex REST mapping
            risks: { stringValue: JSON.stringify(finalResult.risks) },
            goodPoints: { stringValue: JSON.stringify(finalResult.goodPoints) },
            smokingGun: { stringValue: JSON.stringify(finalResult.smokingGun) },
            cachedAt: { timestampValue: new Date().toISOString() }
          }
        })
      }).catch(e => console.warn("Background REST save failed silently.", e));
    }

    return new Response(JSON.stringify(finalResult), { headers: { "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const error = err as Error & { status?: number; statusCode?: number; data?: unknown };
    // Detailed Error Logging for Quota/API diagnostics
    console.error("API ERROR DETECTED:", {
      message: error.message,
      status: error.status || error.statusCode,
      data: error.data,
      model: "internal-model"
    });

    const isQuotaError = error.status === 429 || error.message?.includes("429");
    const errorMessage = isQuotaError 
      ? "AI Limit Reached. Our AI processing quota has been exceeded for the moment. Please wait a minute and try again."
      : error.message || "An unexpected error occurred during analysis.";

    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: error.status || 500 
    }), { 
      status: error.status || 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
