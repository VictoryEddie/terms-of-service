import * as Sentry from '@sentry/nextjs';

export function register() {
  // Validate critical environment variables on startup
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'GROQ_API_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName] || process.env[varName]?.includes('placeholder')
  );

  if (missingVars.length > 0) {
    const errorMsg = `Missing or invalid environment variables: ${missingVars.join(', ')}`;
    console.error('❌ STARTUP ERROR:', errorMsg);
    
    // In production, this is critical
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    } else {
      console.warn('⚠️  Running in development mode with missing env vars. Some features may not work.');
    }
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
