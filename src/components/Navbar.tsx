"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, 
  X, 
  ChevronDown, 
  LayoutDashboard, 
  LogOut,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AuthModal } from "./AuthModal";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { user, signOut, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4",
          isScrolled 
            ? "glass-effect border-b py-3" 
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full group-hover:bg-primary/30 transition-all" />
              <div className="relative flex items-center justify-center font-black text-2xl tracking-tighter text-foreground">
                <span className="gradient-text">(To.S)</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] text-primary uppercase tracking-[0.3em] font-black leading-none mb-0.5">Live Analyser</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-[0.1em] font-medium leading-none">Security First</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex items-center gap-6">
              <Link 
                href="/" 
                className={cn(
                  "text-sm font-semibold transition-all hover:text-primary relative group",
                  pathname === "/" ? "text-primary" : "text-foreground/70"
                )}
              >
                Analyze
                {pathname === "/" && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </Link>
              
            </nav>

            <div className="h-6 w-px bg-foreground/10" />
            
            <div className="flex items-center gap-4">
              <ThemeToggle />

              {user ? (
                <div className="relative group">
                  <button className="flex items-center gap-2 p-1.5 pr-4 rounded-full glass-effect border-foreground/10 hover:border-primary/30 transition-all">
                    <div className="relative">
                      <Image 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                        alt="Profile" 
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full border border-foreground/10"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-xs font-bold text-foreground">{user.displayName?.split(' ')[0]}</span>
                      <span className="text-[10px] text-muted-foreground">Pro Account</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:rotate-180 transition-transform" />
                  </button>
                  
                  {/* Dropdown */}
                  <div className="absolute right-0 top-full pt-3 opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300">
                    <div className="w-56 premium-card p-2 border-foreground/10 overflow-hidden">
                      <div className="px-3 py-2 border-b border-foreground/5 mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account</p>
                        <p className="text-xs font-medium truncate text-foreground">{user.email}</p>
                      </div>
                      <Link href="/dashboard" className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-primary/10 text-sm text-foreground hover:text-primary transition-all group/item">
                        <LayoutDashboard className="w-4 h-4 group-hover/item:scale-110 transition-transform" />
                        Dashboard
                      </Link>
                      <button 
                        onClick={async () => {
                          try {
                            await signOut();
                          } catch (error) {
                            console.error("Sign out failed:", error);
                          }
                        }}
                        className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-destructive/10 text-sm text-destructive/80 hover:text-destructive transition-all group/item"
                      >
                        <LogOut className="w-4 h-4 group-hover/item:translate-x-0.5 transition-transform" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="group relative inline-flex items-center justify-center px-6 py-2 font-bold text-white transition-all duration-200 bg-primary rounded-full hover:bg-brand-indigo shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                >
                  <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                  Get Started
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <button 
              className="p-2.5 rounded-xl glass-effect text-foreground hover:text-primary transition-all border-foreground/10"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-24 px-6 md:hidden flex flex-col"
          >
            <div className="flex flex-col gap-3">
              <Link 
                href="/" 
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border transition-all",
                  pathname === "/" ? "bg-primary/10 border-primary/20 text-primary" : "bg-foreground/5 border-transparent text-foreground"
                )}
              >
                <span className="text-lg font-bold">Analyze New</span>
                <ShieldCheck className="w-5 h-5" />
              </Link>

              {user && (
                <Link 
                  href="/dashboard" 
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    pathname === "/dashboard" ? "bg-primary/10 border-primary/20 text-primary" : "bg-foreground/5 border-transparent text-foreground"
                  )}
                >
                  <span className="text-lg font-bold">Legal Vault</span>
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
              )}
            </div>

            <div className="mt-auto mb-12 flex flex-col gap-4">
              {user ? (
                <button 
                  onClick={async () => {
                    try {
                      await signOut();
                      setIsMenuOpen(false);
                    } catch (error) {
                      console.error("Sign out failed:", error);
                    }
                  }}
                  className="w-full p-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-lg flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsAuthOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full p-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                >
                  Get Started
                </button>
              )}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">(To.S) Analyser v2.0</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onGoogleSignIn={signInWithGoogle} />
    </>
  );
}
