"use client";

import { motion, AnimatePresence } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import { ShieldAlert, Zap, ArrowRight, Loader2, AlertTriangle, Lock, Search, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { ReportCard } from "@/components/ReportCard";
import { cn } from "@/lib/utils";
import { AuthModal } from "@/components/AuthModal";
import { SourceViewer } from "@/components/SourceViewer";
import { useAuth } from "@/hooks/useAuth";
import { saveReport } from "@/lib/reports";
import { AnalysisResult } from "@/types/analysis";
import { legalFacts } from "@/data/legal-facts";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { ComparisonDrawer } from "@/components/ComparisonDrawer";

type AppState = "idle" | "loading" | "result" | "error";
interface ComparisonResult {
  sentimentShift: "better" | "worse" | "neutral";
  summary: string;
  majorChanges: Array<{
    type: "added" | "removed" | "modified";
    impact: "high" | "medium" | "low";
    title: string;
    description: string;
  }>;
  verdict: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [object, setObject] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<string>("");
  const [fullSourceText, setFullSourceText] = useState("");
  const [loadingStage, setLoadingStage] = useState<string>("Initializing...");

  const { user, signInWithGoogle } = useAuth();
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    const checkDuplicate = async () => {
      if (user && object?.contentHash) {
        try {
          const q = query(
            collection(db, "users", user.uid, "reports"),
            where("contentHash", "==", object.contentHash),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (isMounted && !snapshot.empty) {
            setIsSaved(true);
          }
        } catch (e) {
          console.warn("Duplicate check failed:", e);
        }
      }
    };
    
    checkDuplicate();
    
    return () => {
      isMounted = false;
    };
  }, [user, object]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      setFactIndex(Math.floor(Math.random() * legalFacts.length));
      interval = setInterval(() => {
        setFactIndex((prev) => (prev + 1) % legalFacts.length);
      }, 6000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  const handleAnalyze = async (forceParam: boolean = false) => {
    const force = forceParam === true;
    if (!input.trim()) return;
    Sentry.captureMessage("Analysis started", {
      level: "info",
      extra: {
        source: input.startsWith("http") ? "url" : "text",
        inputLength: input.length
      }
    });

    setIsLoading(true);
    setAppState("loading");
    setLoadingStage(input.startsWith("http") ? "Scraping Legal Content..." : "Preprocessing Document...");
    setError(null);
    setObject(null);
    setIsSaved(false);
    setFullSourceText(input);
    
    try {
      setTimeout(() => setLoadingStage("Detecting Clause Patterns..."), 3000);
      setTimeout(() => setLoadingStage("Running AI Risk Assessment..."), 7000);
      setTimeout(() => setLoadingStage("Finalizing Analysis Report..."), 12000);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(input.startsWith("http") ? { url: input } : { text: input }),
          force
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Analysis failed");
      }

      const data = await res.json();
      setObject(data);
      setAppState("result");
    } catch (err: unknown) {
      console.error("Analysis Error:", err);
      setError((err as Error).message || "An unexpected error occurred");
      setAppState("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRiskClick = (quote: string) => {
    setSelectedQuote(quote);
    setIsSourceOpen(true);
  };

  const handleSave = async () => {
    if (!object) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      await saveReport(user.uid, object as AnalysisResult);
      setIsSaved(true);
    } catch (error) {
      console.error("Failed to save report:", error);
      Sentry.captureException(error, {
        tags: { action: "save_report" },
        extra: { userId: user.uid, contentHash: object.contentHash }
      });
      // Error will be shown via toast in the UI
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompare = async () => {
    if (!object?.contentHash || !object?.previousVersionId) return;
    setIsComparing(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentHash: object.contentHash,
          previousHash: object.previousVersionId
        })
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setComparisonResult(data);
    } catch (err) {
      console.error("Comparison failed:", err);
      Sentry.captureException(err, {
        tags: { action: "compare_versions" },
        extra: { 
          currentHash: object.contentHash, 
          previousHash: object.previousVersionId 
        }
      });
      setError("Failed to compare versions. Please try again.");
    } finally {
      setIsComparing(false);
    }
  };

  const resetToIdle = () => {
    setAppState("idle");
    setInput("");
    setIsSaved(false);
    setComparisonResult(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6 pt-32 md:pt-48 relative overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="absolute top-0 left-0 right-0 h-screen w-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-accent/5 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-5xl w-full space-y-24 relative z-10">
        <AnimatePresence mode="wait">
          {appState === "idle" && (
            <motion.div 
              key="idle" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="space-y-32"
            >
              {/* Hero Section */}
              <div className="text-center space-y-10">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-effect border-primary/20 text-[11px] font-bold uppercase tracking-[0.25em] text-primary shimmer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Your Privacy, Decoded
                </motion.div>
                
                <div className="space-y-6">
                  <motion.h1 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.1, type: "spring", stiffness: 100 }} 
                    className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85] text-balance"
                  >
                    Uncover the <br />
                    <span className="gradient-text italic">Fine Print.</span>
                  </motion.h1>
                  
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.2 }} 
                    className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium text-balance"
                  >
                    Instantly scan Terms of Service to find hidden risks, predatory data practices, and clauses that impact your legal rights.
                  </motion.p>
                </div>
              </div>

              {/* Input Section */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }} 
                className="max-w-3xl mx-auto relative group"
              >
                <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 via-secondary/30 to-accent/30 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000 animate-mesh" />
                <div className="relative premium-card p-4 flex flex-col gap-4 border-foreground/5">
                  <div className="relative">
                    <Search className="absolute left-5 top-6 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <textarea
                      id="tos-input"
                      rows={5}
                      placeholder="Paste a URL or drop the legal text directly..."
                      className="w-full bg-transparent border-none rounded-2xl py-5 pl-14 pr-6 focus:outline-none transition-all resize-none text-lg leading-relaxed placeholder:text-muted-foreground/20 text-foreground"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnalyze(false)}
                    disabled={!input.trim() || isLoading}
                    className="w-full relative group/btn overflow-hidden rounded-2xl bg-foreground text-background dark:bg-white dark:text-black font-black py-5 flex items-center justify-center gap-3 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                    <span className="relative z-10 text-lg">
                      {isLoading ? "Processing Request..." : "Start AI Analysis"}
                    </span>
                    {!isLoading && <ArrowRight className="relative z-10 w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />}
                  </motion.button>
                </div>
              </motion.div>

              {/* Features Grid */}
              <div className="space-y-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { icon: <ShieldAlert className="w-6 h-6" />, title: "Risk Detection", description: "Spot predatory clauses: data selling, liability waivers, and forced arbitration.", color: "text-red-500" },
                    { icon: <Zap className="w-6 h-6" />, title: "Instant Grading", description: "Get a legal health score A–F in seconds using our AI reasoning engine.", color: "text-amber-500" },
                    { icon: <Lock className="w-6 h-6" />, title: "Privacy First", description: "Real-time analysis. We never store your raw content or link it to your identity.", color: "text-emerald-500" },
                  ].map((card, idx) => (
                    <motion.div 
                      key={card.title} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: 0.4 + idx * 0.1 }} 
                      className="premium-card p-8 group hover:border-primary/40 relative overflow-hidden"
                    >
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                      <div className={cn("w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500", card.color)}>
                        {card.icon}
                      </div>
                      <h3 className="font-black text-xl mb-4 text-foreground">{card.title}</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium">{card.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Steps Section */}
              <div className="py-24 space-y-20 border-t border-foreground/5">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-black tracking-tighter text-foreground">Three Steps to Safety</h2>
                  <p className="text-xl text-muted-foreground max-w-md mx-auto font-medium">Regain control of your digital rights in seconds.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                  {[
                    { step: "01", title: "Submit Content", desc: "Paste a URL or raw text. Our scrapers automatically extract the core legal data." },
                    { step: "02", title: "AI Audit", desc: "Our AI scans for 50+ known predatory legal patterns and privacy infringements." },
                    { step: "03", title: "Review Report", desc: "Receive a clear summary, risk scores, and actionable insights to protect yourself." }
                  ].map((item, idx) => (
                    <div key={idx} className="relative group">
                      <span className="text-[120px] font-black text-foreground/13 absolute -top-16 -left-4 select-none pointer-events-none group-hover:text-primary/5 transition-colors duration-500">{item.step}</span>
                      <div className="relative pt-4 space-y-4">
                        <h4 className="font-black text-2xl text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                        <p className="text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {(isLoading || (appState === "loading" && !object)) && (
            <motion.div 
              key="loading" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }} 
              className="flex flex-col items-center justify-center min-h-[60vh] md:min-h-[55vh] gap-8 md:gap-7 text-center"
            >
              <div className="relative">
                <div className="w-28 h-28 md:w-24 md:h-24 rounded-full glass-effect flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 animate-spin" />
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse blur-xl" />
              </div>
              
              <div className="space-y-8 max-w-[430px] mx-auto">
                <div className="space-y-3">
                  <h2 className="text-3xl font-black tracking-tight text-foreground gradient-text">
                    {loadingStage}
                  </h2>
                  <p className="text-muted-foreground text-base font-medium">
                    {input.startsWith("http") 
                      ? "Bypassing junk and fetching legal content." 
                      : "Scanning for hidden risks and predatory clauses."}
                  </p>
                </div>
                
                <div className="w-full h-[10px] bg-foreground/5 rounded-full overflow-hidden border border-foreground/5 p-0.5">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: 15, ease: "linear" }}
                    className="h-full bg-gradient-to-r from-primary via-secondary to-accent rounded-full"
                  />
                </div>
                
                <div className="pt-8 border-t border-foreground/5">
                  <div className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mb-5">Legal Insight</div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={factIndex}
                      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                      className="premium-card p-5 border-primary/10"
                    >
                      <p className="text-[14px] text-foreground/90 italic leading-relaxed font-medium">
                        &quot;{legalFacts[factIndex]}&quot;
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {(object || appState === "result") && (
            <motion.div 
              key="result" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-12"
            >
              <div className="flex items-center justify-between mb-8">
                <motion.button 
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetToIdle} 
                  className="group flex items-center gap-2 px-6 py-3 rounded-2xl glass-effect border-foreground/5 hover:border-primary/20 text-foreground transition-all text-sm font-black"
                >
                  <ArrowRight className="w-4 h-4 rotate-180 text-primary group-hover:-translate-x-1 transition-transform" />
                  Analyze New Document
                </motion.button>
              </div>
              
              {object && (object.appName || object.summary) ? (
                <div className="animate-in">
                  <ReportCard
                    result={object as AnalysisResult}
                    onSave={handleSave}
                    isSaving={isSaving}
                    isSaved={isSaved}
                    onCompare={handleCompare}
                    isComparing={isComparing}
                    onRiskClick={handleRiskClick}
                  />
                  
                  {/* Troubleshooting Link */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-32 pt-16 border-t border-foreground/5 flex flex-col items-center gap-8 text-center"
                  >
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px] font-black uppercase tracking-widest">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>Report looks incomplete?</span>
                    </div>
                    <button 
                      onClick={() => handleAnalyze(true)} 
                      disabled={isLoading}
                      className="group premium-card p-8 hover:border-primary/30 transition-all max-w-md"
                    >
                      <span className="text-lg font-black text-foreground">
                        Force Deep Refresh
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                        Bypasses all cache layers to generate a completely fresh analysis from the original source.
                      </p>
                    </button>
                  </motion.div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-48 gap-8">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full glass-effect flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
                  </div>
                  <p className="text-lg text-muted-foreground font-black italic tracking-tight">Generating detailed forensic report...</p>
                </div>
              )}
            </motion.div>
          )}

          {appState === "error" && (
            <motion.div 
              key="error" 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(239,68,68,0.2)]">⚠️</div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-foreground tracking-tight">Analysis Interrupted</h2>
                <p className="text-muted-foreground text-lg max-w-sm mx-auto font-medium leading-relaxed">
                  {error || "An unexpected error occurred during processing. Please verify the URL or text and try again."}
                </p>
              </div>
              <button 
                onClick={resetToIdle} 
                className="px-10 py-4 rounded-2xl bg-foreground text-background dark:bg-white dark:text-black font-black text-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all active:scale-95"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ComparisonDrawer 
        isOpen={!!comparisonResult}
        onClose={() => setComparisonResult(null)}
        result={comparisonResult}
        appName={object?.appName || "App"}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onGoogleSignIn={signInWithGoogle} />
      
      <SourceViewer 
        isOpen={isSourceOpen} 
        onClose={() => setIsSourceOpen(false)} 
        text={fullSourceText} 
        highlightQuote={selectedQuote} 
      />
    </main>
  );
}
