"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Clock,
  Trash2,
  ExternalLink,
  Search,
  ChevronRight,
  Globe,
  FileText,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AnalysisResult } from "@/types/analysis";
import { ReportCard } from "@/components/ReportCard";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<(AnalysisResult & { id: string })[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "link" | "text">("all");
  const [selectedReport, setSelectedReport] = useState<
    (AnalysisResult & { id: string }) | null
  >(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "reports"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (AnalysisResult & { id: string })[];

      setReports(docs);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Separate effect for body overflow management
  useEffect(() => {
    if (selectedReport) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedReport]);

  const handleDelete = async (id: string) => {
    if (
      !user ||
      !confirm(
        "Are you sure you want to delete this analysis from your Legal Vault?"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "reports", id));
      setSelectedReport(null);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // Memoize stats calculation to avoid recalculating on every render
  const stats = useMemo(() => {
    return {
      total: reports.length,
      avgScore:
        reports.length > 0
          ? Math.round(
              reports.reduce((acc, r) => acc + (r.transparencyScore || 0), 0) /
                reports.length
            )
          : 0,
      timeSaved: reports.reduce((acc, r) => acc + (r.timeSavedMinutes || 0), 0),
    };
  }, [reports]);

  // Memoize filtered reports to avoid recalculating on every render
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesSearch =
        r.appName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterType === "all" || r.analysisSource === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [reports, searchQuery, filterType]);

  if (!user && !isLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="space-y-6">
          <div className="text-6xl font-black tracking-tighter">
            <span className="text-primary">(</span>To.S
            <span className="text-primary">)</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vault Locked</h1>
          <p className="text-muted-foreground">
            Please sign in to view your Legal Vault.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-20 px-6 max-w-7xl mx-auto">
      {/* Stats Header */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {[
          {
            label: "Reports Analyzed",
            value: stats.total,
            icon: History,
            color: "text-blue-400",
          },
          {
            label: "Average Safety",
            value: `${stats.avgScore}%`,
            icon: Shield,
            color: "text-emerald-400",
          },
          {
            label: "Life Saved",
            value: `${stats.timeSaved}m`,
            icon: Clock,
            color: "text-amber-400",
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center gap-4"
          >
            <div className={cn("p-3 rounded-xl bg-foreground/5", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Content */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            My Legal Vault
            <span className="text-xs bg-foreground/5 px-2 py-0.5 rounded-full text-muted-foreground font-normal border border-border">
              {reports.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-foreground/5 border border-border rounded-xl py-2 pl-10 pr-4 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {filterType !== "all" && (
              <button
                onClick={() => setFilterType("all")}
                className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
              >
                Clear: {filterType}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 rounded-2xl bg-foreground/5 animate-pulse"
              />
            ))}
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <motion.button
                key={report.id}
                layoutId={report.id}
                onClick={() => setSelectedReport(report)}
                className="glass-card p-5 group cursor-pointer hover:border-primary/30 transition-all flex flex-col gap-4 text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={`View report for ${report.appName}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                        report.grade?.[0] === "A" || report.grade?.[0] === "B"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      )}
                    >
                      {report.grade || "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {report.appName}
                        </h3>
                        {report.analysisSource === "link" ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterType("link");
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            Link
                          </div>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterType("text");
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/5 border border-border text-[9px] font-black uppercase text-muted-foreground hover:bg-foreground/10 transition-all cursor-pointer"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            Text
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {report.jurisdiction || "Global"}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {report.summary}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                  {report.sourceUrl && (
                    <a
                      href={report.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Source
                    </a>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    View Details
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="glass-card py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mx-auto text-3xl">
              📭
            </div>
            <h3 className="font-bold text-xl text-foreground">
              Your Vault is Empty
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              You haven&apos;t saved any legal analyses yet. Analyze a Terms of
              Service to start your collection.
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl h-full flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass-effect border-foreground/10 text-foreground hover:border-primary/30 hover:text-primary transition-all text-sm font-medium"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back to Vault
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div
                className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl pb-10 space-y-6"
                data-lenis-prevent
              >
                <ReportCard
                  result={selectedReport}
                  onSave={() => {}}
                  isSaving={false}
                  isSaved={true}
                />

                {/* Delete Action */}
                <div className="flex justify-center pt-10 pb-20">
                  <button
                    onClick={() => handleDelete(selectedReport.id)}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all text-sm font-black uppercase tracking-widest"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete from Legal Vault
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
