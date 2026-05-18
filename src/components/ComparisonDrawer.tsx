"use client";

import { Drawer } from "vaul";
import { motion } from "framer-motion";
import { History, CheckCircle2, AlertTriangle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonChange {
  type: "added" | "removed" | "modified";
  impact: "high" | "medium" | "low";
  title: string;
  description: string;
}

export interface ComparisonResult {
  sentimentShift: "better" | "worse" | "neutral";
  summary: string;
  majorChanges: ComparisonChange[];
  verdict: string;
}

interface ComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result: ComparisonResult | null;
  appName: string;
}

const { Root, Portal, Overlay, Content, Title } = Drawer;

export function ComparisonDrawer({ isOpen, onClose, result, appName }: ComparisonDrawerProps) {
  if (!result) return null;

  return (
    <Root 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground
    >
      <Portal>
        <Overlay className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 transition-all duration-300" />
        <Content className="bg-background flex flex-col rounded-t-[32px] mt-24 fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] outline-none border-t border-border">
          <Title className="sr-only">Time Machine Audit</Title>
          <div className="p-6 bg-background/80 backdrop-blur-xl rounded-t-[32px] flex-1 overflow-y-auto custom-scrollbar">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-foreground/10 mb-8" />
            
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="relative mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                      <History className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-3xl heading-premium uppercase text-foreground tracking-tight">Time Machine Audit</h2>
                      <p className="text-sm text-foreground/60 font-medium tracking-wide">Comparing version updates for {appName}</p>
                    </div>
                  </div>
                </div>

                {/* Sentiment Shift */}
                <div className="mt-8 flex items-center gap-4">
                  <div className={cn(
                    "px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-sm uppercase tracking-widest border transition-all duration-500",
                    result.sentimentShift === "better" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/5" :
                    result.sentimentShift === "worse" ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-lg shadow-red-500/5" :
                    "bg-foreground/5 text-foreground border-foreground/10"
                  )}>
                    {result.sentimentShift === "better" ? <CheckCircle2 className="w-6 h-6" /> :
                     result.sentimentShift === "worse" ? <AlertTriangle className="w-6 h-6" /> :
                     <Shield className="w-6 h-6" />}
                    Verdict: <span className="font-black underline underline-offset-4">{result.sentimentShift}</span>
                  </div>
                </div>
              </div>

              {/* Comparison Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pb-12">
                <div className="space-y-10">
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80 mb-6">Change Summary</h3>
                    <p className="text-xl text-foreground/90 leading-relaxed font-semibold tracking-tight">{result.summary}</p>
                  </div>

                  <div className="p-8 rounded-[2rem] bg-foreground/[0.03] border border-border italic text-base text-foreground/80 leading-relaxed shadow-inner">
                    &quot;{result.verdict}&quot;
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80 mb-6">Key Differences</h3>
                  <div className="space-y-4">
                    {result.majorChanges.map((change, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                        className="glass-card !p-6 space-y-4 hover:border-primary/30 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border transition-colors",
                            change.type === "added" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10 group-hover:bg-emerald-500/20" :
                            change.type === "removed" ? "text-red-500 border-red-500/20 bg-red-500/10 group-hover:bg-red-500/20" :
                            "text-amber-500 border-amber-500/20 bg-amber-500/10 group-hover:bg-amber-500/20"
                          )}>
                            {change.type}
                          </span>
                          <span className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">{change.impact} Impact</span>
                        </div>
                        <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{change.title}</h4>
                        <p className="text-sm text-foreground/60 leading-relaxed font-medium">{change.description}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Content>
      </Portal>
    </Root>
  );
}
