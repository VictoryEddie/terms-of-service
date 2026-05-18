"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="space-y-10 max-w-md relative z-10"
      >
        {/* Icon + ghost 404 */}
        <div className="relative flex items-center justify-center h-40">
          <span className="text-[9rem] font-black text-foreground/[0.04] select-none absolute leading-none">
            404
          </span>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="relative w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)]"
          >
            <ShieldAlert className="w-12 h-12 text-primary" />
          </motion.div>
        </div>

        {/* Copy */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-tight">
            Lost in the Fine Print?
          </h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            The page you&apos;re looking for has been redacted, moved, or never
            existed in this agreement.
          </p>
        </div>

        {/* CTA */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Link
            href="/"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Analyser
          </Link>
        </motion.div>

        {/* Branding footer */}
        <div className="pt-8 opacity-30 flex items-center justify-center gap-3">
          <div className="w-8 h-px bg-foreground" />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-foreground">
            (To.S) Analyser
          </span>
          <div className="w-8 h-px bg-foreground" />
        </div>
      </motion.div>
    </main>
  );
}
