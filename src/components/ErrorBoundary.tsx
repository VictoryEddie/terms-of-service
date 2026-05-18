"use client";

import React, { Component, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 border border-destructive/20">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-3">
            Something Went Wrong
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            We encountered an unexpected error. Our team has been notified.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all active:scale-95"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
