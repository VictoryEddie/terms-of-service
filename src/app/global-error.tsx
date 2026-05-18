'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white font-sans antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          {/* Neon background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 space-y-6 max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 animate-pulse">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-3xl font-black tracking-tight text-white">Something went wrong!</h2>
            <p className="text-zinc-400 font-medium leading-relaxed">
              A critical application error has occurred. Our engineering team has been automatically notified of this issue.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
