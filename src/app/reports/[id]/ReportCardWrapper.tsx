"use client";

import { ReportCard } from "@/components/ReportCard";
import { AnalysisResult } from "@/types/analysis";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { saveReport } from "@/lib/reports";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { AuthModal } from "@/components/AuthModal";
import { SourceViewer } from "@/components/SourceViewer";
import { ComparisonDrawer, ComparisonResult } from "@/components/ComparisonDrawer";

export function ReportCardWrapper({ result }: { result: AnalysisResult }) {
  const { user, signInWithGoogle } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState("");

  useEffect(() => {
    let isMounted = true;
    
    const checkDuplicate = async () => {
      if (user && result.contentHash) {
        try {
          const q = query(
            collection(db, "users", user.uid, "reports"),
            where("contentHash", "==", result.contentHash),
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
  }, [user, result.contentHash]);

  const handleSave = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      await saveReport(user.uid, result);
      setIsSaved(true);
      toast.success("Report saved to your Vault!");
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error("Failed to save report. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompare = async () => {
    if (!result.contentHash || !result.previousVersionId) return;
    setIsComparing(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentHash: result.contentHash,
          previousHash: result.previousVersionId
        })
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setComparisonResult(data);
    } catch (error) {
      console.error("Comparison failed:", error);
      toast.error("Comparison failed. Please try again later.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleRiskClick = (quote: string) => {
    setSelectedQuote(quote);
    setIsSourceOpen(true);
  };

  return (
    <>
      <ReportCard 
        result={result}
        onSave={handleSave}
        isSaving={isSaving}
        isSaved={isSaved}
        onCompare={result.previousVersionId ? handleCompare : undefined}
        isComparing={isComparing}
        onRiskClick={handleRiskClick}
      />

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onGoogleSignIn={async () => {
          await signInWithGoogle();
          setIsAuthOpen(false);
        }} 
      />

      <SourceViewer 
        isOpen={isSourceOpen}
        onClose={() => setIsSourceOpen(false)}
        highlightQuote={selectedQuote}
        text={result.sourceUrl ? `Source content from ${result.sourceUrl}` : "Source text provided during analysis."}
      />

      {comparisonResult && (
        <ComparisonDrawer 
          isOpen={!!comparisonResult}
          onClose={() => setComparisonResult(null)}
          result={comparisonResult}
          appName={result.appName || "App"}
        />
      )}
    </>
  );
}
