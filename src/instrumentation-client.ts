import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Required by Sentry to instrument Next.js navigation events
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
