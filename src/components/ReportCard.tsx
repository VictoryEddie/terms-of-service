"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Share2,
  BookmarkPlus,
  X,
  Globe,
  Zap,
  History,
  ArrowRight,
  Loader2,
  Target,
  Trophy,
  ShieldCheck,
  Search
} from "lucide-react";
import { AnalysisResult, Risk } from "@/types/analysis";
import { cn } from "@/lib/utils";
import ExportButton from "./ExportButton";

interface ReportCardProps {
  result: AnalysisResult;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  onCompare?: () => void;
  isComparing?: boolean;
}

const gradeColors: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-green-400",
  C: "text-amber-400",
  D: "text-orange-500",
  F: "text-red-500",
};

const severityConfig = {
  high: {
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: <ShieldAlert className="w-4 h-4" />,
    label: "High Risk",
  },
  medium: {
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Medium Risk",
  },
  low: {
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    icon: <Info className="w-4 h-4" />,
    label: "Minor Detail",
  },
};

function ScoreGauge({ score, grade, risks }: { score: number; grade: string; risks: Risk[] }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const circumference = 2 * Math.PI * 54;
  const progress = ((100 - score) / 100) * circumference;
  const gradeColor = gradeColors[grade[0]] ?? "text-muted-foreground";

  // Memoize deductions calculation to avoid recalculating on every render
  const deductions = useMemo(() => {
    return risks.map(r => ({
      title: r.title,
      points: r.severity === "high" ? 15 : r.severity === "medium" ? 8 : 4
    })).sort((a, b) => b.points - a.points);
  }, [risks]);

  return (
    <>
      <button
        onClick={() => setShowBreakdown(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowBreakdown(true);
          }
        }}
        aria-label="View score breakdown"
        className="relative flex items-center justify-center w-56 h-56 mx-auto cursor-pointer group focus:outline-none focus:ring-4 focus:ring-primary/50 rounded-full"
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-[60px] group-hover:bg-primary/20 transition-all duration-700" />
        <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="6" className="text-foreground/[0.03]" />
          <motion.circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progress }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            strokeDasharray={circumference}
            className="drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <motion.span 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn("text-7xl font-black tracking-tighter group-hover:scale-110 transition-transform duration-500", gradeColor)}
          >
            {grade}
          </motion.span>
          <span className="text-xs text-muted-foreground font-black tracking-[0.3em] uppercase mt-1">{score}/100</span>
          <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 flex items-center gap-1.5">
            <Search className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">View Breakdown</span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {showBreakdown && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowBreakdown(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-xl" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-md premium-card relative z-10 p-10 space-y-8 border-foreground/10"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-foreground tracking-tight">Scoring Matrix</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Detailed Risk Impact</p>
                </div>
                <button onClick={() => setShowBreakdown(false)} className="p-3 rounded-2xl glass-effect hover:bg-destructive/10 hover:text-destructive transition-all group">
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-foreground font-black uppercase tracking-widest p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/5">
                  <span className="flex items-center gap-2 text-primary"><Trophy className="w-4 h-4" /> Baseline</span>
                  <span className="text-primary">100 pts</span>
                </div>
                
                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-3 custom-scrollbar">
                  {deductions.map((d, i) => (
                    <div key={i} className="flex items-center justify-between group py-3 px-1 border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors rounded-xl">
                      <div className="flex flex-col gap-0.5 max-w-[70%]">
                        <span className="text-sm text-foreground font-bold truncate group-hover:text-primary transition-colors">{d.title}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Impact Weight</span>
                      </div>
                      <span className="text-sm font-black text-red-500/80">-{d.points}</span>
                    </div>
                  ))}
                  {deductions.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground italic font-medium">No deductions found. Perfect score!</div>
                  )}
                </div>

                <div className="pt-6 border-t border-foreground/10 flex items-center justify-between">
                  <span className="text-sm font-black text-foreground uppercase tracking-[0.3em]">Trust Quotient</span>
                  <span className={cn("text-4xl font-black gradient-text", gradeColor)}>{score}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function RiskCard({ risk, onClick }: { risk: Risk; onClick?: (quote: string) => void }) {
  const config = severityConfig[risk.severity];
  
  const handleClick = () => {
    if (risk.quote && onClick) {
      onClick(risk.quote);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && risk.quote && onClick) {
      e.preventDefault();
      onClick(risk.quote);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={risk.quote ? 0 : undefined}
      role={risk.quote ? "button" : undefined}
      aria-label={risk.quote ? `View source for ${risk.title}` : undefined}
      className={cn(
        "premium-card p-6 flex flex-col gap-3.5 group hover:border-primary/40 relative overflow-hidden",
        risk.quote ? "cursor-pointer active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/50" : "cursor-default"
      )}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl bg-opacity-20", config.bg, config.color)}>
            {config.icon}
          </div>
          <span className={cn("text-[10px] font-black uppercase tracking-[0.25em]", config.color)}>
            {config.label}
          </span>
        </div>
        {risk.quote && <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />}
      </div>
      
      <div className="space-y-1.5">
        <h4 className="font-black text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">{risk.title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed font-medium line-clamp-3">{risk.description}</p>
      </div>

      {risk.quote && (
        <div className="relative mt-4">
          <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-primary/50 to-transparent rounded-full" />
          <blockquote className="text-[11px] text-muted-foreground/50 italic pl-5 py-1 line-clamp-2">
            &quot;{risk.quote}&quot;
          </blockquote>
        </div>
      )}
    </motion.div>
  );
}

export function ReportCard({ result, onSave, isSaving, isSaved, onCompare, isComparing, onRiskClick }: ReportCardProps & { onRiskClick?: (quote: string) => void }) {
  const [isCopied, setIsCopied] = useState(false);
  
  // Memoize risks array and categorization to avoid recalculating on every render
  const { risks, highRisks, otherRisks } = useMemo(() => {
    const allRisks = result.risks || [];
    return {
      risks: allRisks,
      highRisks: allRisks.filter((r) => r.severity === "high"),
      otherRisks: allRisks.filter((r) => r.severity !== "high")
    };
  }, [result.risks]);
  
  const goodPoints = result.goodPoints || [];

  const shareReport = async () => {
    const text = `I just analyzed ${result.appName}'s Terms of Service and it got a ${result.grade} (${result.transparencyScore}/100)! 🔍 Check what they're hiding → ${window.location.href}`;
    const handleSuccess = () => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };
    if (navigator.share) {
      try { await navigator.share({ title: `${result.appName} ToS Report`, text }); return; } catch { return; }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        handleSuccess();
      } else {
        const el = document.createElement("textarea");
        el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
        document.body.appendChild(el); el.focus(); el.select();
        document.execCommand("copy"); document.body.removeChild(el);
        handleSuccess();
      }
    } catch (e) { console.error("Share/copy error", e); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full space-y-12"
      >
        {/* Version Update detected */}
        {result.previousVersionId && onCompare && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden group rounded-[2rem] cursor-pointer"
            onClick={onCompare}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent group-hover:scale-105 transition-transform duration-1000 animate-mesh" />
            <div className="relative z-10 premium-card border-primary/20 p-6 flex items-center justify-between gap-6 overflow-hidden">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center group-hover:rotate-12 transition-all duration-500">
                  <History className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-foreground tracking-tight">Legal Evolution Detected</h4>
                  <p className="text-[10px] text-primary/60 tracking-[0.2em] uppercase font-black mt-1">Audit changes against previous version</p>
                </div>
              </div>
              <button className="relative group/btn flex items-center gap-3 px-8 py-4 rounded-2xl bg-foreground text-background dark:bg-white dark:text-black text-xs font-black uppercase tracking-[0.2em] hover:shadow-2xl transition-all active:scale-95">
                {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isComparing ? "Processing..." : "Compare Versions"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Hero Score Card */}
        <div className="premium-card p-8 md:p-14 text-center space-y-8 relative overflow-hidden border-foreground/5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />
          
          {!result.isTermsOfService ? (
            <div className="space-y-8 py-16">
              <div className="w-24 h-24 rounded-[2rem] bg-amber-500/10 flex items-center justify-center text-5xl mx-auto border border-amber-500/20 shimmer">🧐</div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black tracking-tighter text-foreground">Ambiguous Content</h2>
                <p className="text-muted-foreground text-xl max-w-xl mx-auto leading-relaxed font-medium">{result.summary}</p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em]">
                Please provide valid legal documentation
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                <motion.h2 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-6xl font-black text-foreground tracking-tighter leading-[0.9]"
                >
                  {result.appName}
                </motion.h2>
                {result.jurisdiction && (
                  <span className="text-[11px] text-primary uppercase font-black tracking-[0.4em] flex items-center gap-2.5 px-5 py-2 rounded-full glass-effect border-primary/20">
                    <Globe className="w-4 h-4" />
                    Jurisdiction: {result.jurisdiction}
                  </span>
                )}
              </div>

              <ScoreGauge 
                score={result.transparencyScore || 0} 
                grade={result.grade || "?"} 
                risks={risks}
              />
              
              <div className="space-y-7">
                <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-medium text-balance">{result.summary}</p>
                
                {result.timeSavedMinutes && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-black uppercase tracking-[0.25em] shimmer"
                  >
                    <Zap className="w-4 h-4 fill-primary" />
                    Bypassed {result.timeSavedMinutes} minutes of fine print
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3.5 justify-center pt-6 flex-wrap">
                <ExportButton data={result} />
                <button
                  onClick={shareReport}
                  className={cn(
                    "flex items-center gap-3 px-10 py-5 rounded-2xl border text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95",
                    isCopied 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                      : "glass-effect border-foreground/10 hover:border-primary/30 text-foreground"
                  )}
                >
                  {isCopied ? <CheckCircle2 className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                  {isCopied ? "Copied!" : "Share Report"}
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving || isSaved || !result.appName}
                  className={cn(
                    "flex items-center gap-3 px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl",
                    isSaved
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 cursor-not-allowed opacity-70"
                      : "bg-foreground text-background dark:bg-white dark:text-black hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                  )}
                >
                  {isSaved ? (
                    <><ShieldCheck className="w-5 h-5" /> In Vault</>
                  ) : (
                    <><BookmarkPlus className="w-5 h-5" /> {isSaving ? "Securing..." : "Save to Vault"}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* The Smoking Gun */}
        {result.isTermsOfService && result.smokingGun && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden group rounded-[2.5rem]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-transparent to-transparent group-hover:scale-110 transition-transform duration-1000" />
            <div className="premium-card border-red-500/30 relative z-10 p-8 md:p-12 space-y-7">
              <div className="flex items-center gap-4 text-red-500">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <Target className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.5em] block">Priority Alert</span>
                  <span className="text-xl font-black uppercase tracking-tight">The Smoking Gun</span>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-2xl md:text-3xl font-black text-foreground tracking-tighter leading-tight">{result.smokingGun.title}</h4>
                <p className="text-base text-muted-foreground leading-relaxed font-medium max-w-3xl">{result.smokingGun.description}</p>
              </div>
              <div className="relative">
                <div className="absolute -inset-1 bg-red-500/10 rounded-3xl blur-xl" />
                <div className="relative bg-red-500/5 rounded-3xl p-8 border border-red-500/10">
                  <p className="text-lg text-red-500 font-black italic leading-relaxed text-balance">
                    &quot;{result.smokingGun.clause}&quot;
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Risks Grid */}
        {(highRisks.length > 0 || otherRisks.length > 0) && (
          <div className="space-y-7">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.5em] flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-primary" />
                Risk Analysis ({highRisks.length + otherRisks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {[...highRisks, ...otherRisks].map((risk, i) => (
                <RiskCard key={i} risk={risk} onClick={onRiskClick} />
              ))}
            </div>
          </div>
        )}

        {/* Good Points */}
        {goodPoints.length > 0 && (
          <div className="space-y-7 pt-7">
            <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.5em] px-2 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Pro-User Clauses ({goodPoints.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {goodPoints.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="premium-card p-7 border-emerald-500/10 bg-emerald-500/[0.02] group hover:border-emerald-500/40 transition-all overflow-hidden relative"
                >
                  <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h4 className="font-black text-lg text-foreground tracking-tight group-hover:text-emerald-400 transition-colors">{point.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">{point.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
