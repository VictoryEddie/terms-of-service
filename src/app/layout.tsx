import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "(To.S) | Uncover the Fine Print",
  description: "Instantly scan Terms of Service documents with AI to find hidden risks, predatory clauses, and data privacy issues. Know what you're agreeing to before you click accept.",
  keywords: ["terms of service", "privacy policy", "legal analysis", "AI legal", "TOS scanner", "fine print"],
  openGraph: {
    title: "(To.S) — AI Legal Analyser",
    description: "Uncover what you're really agreeing to. AI-powered Terms of Service analysis that spots the clauses companies don't want you to read.",
    type: "website",
    siteName: "(To.S) Analyser",
  },
  twitter: {
    card: "summary_large_image",
    title: "(To.S) — AI Legal Analyser",
    description: "Know what you're agreeing to before you click Accept.",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "darkreader-lock": "true",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

import { Navbar } from "@/components/Navbar";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "antialiased bg-background text-foreground transition-colors duration-300")} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <SmoothScroll>
              <div vaul-drawer-wrapper="" className="min-h-screen bg-background">
                <Navbar />
                {children}
              </div>
              <Toaster position="top-right" richColors closeButton />
            </SmoothScroll>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
