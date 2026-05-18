# Environment Variables Audit 🔍

**Date:** May 18, 2026  
**Project:** ToS Analyser

---

## ✅ **Current Status: MISSING 1 VARIABLE**

Your `.env.local` has **9 out of 10** required variables.

---

## 📋 **Required Environment Variables**

### **✅ PRESENT (9 variables)**

#### **1. Firebase Configuration (6 variables)**
```bash
✅ NEXT_PUBLIC_FIREBASE_API_KEY              # Present
✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          # Present
✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID           # Present
✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       # Present
✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  # Present
✅ NEXT_PUBLIC_FIREBASE_APP_ID               # Present
```
**Used in:** `src/lib/firebase.ts`, `src/app/api/og/route.tsx`, `src/app/api/analyze/route.ts`

#### **2. Groq AI API (1 variable)**
```bash
✅ GROQ_API_KEY                              # Present
```
**Used in:** `src/app/api/analyze/route.ts`, `src/app/api/compare/route.ts`

#### **3. Upstash Redis (2 variables)**
```bash
✅ UPSTASH_REDIS_REST_URL                    # Present
✅ UPSTASH_REDIS_REST_TOKEN                  # Present
```
**Used in:** `src/lib/redis.ts`, `src/lib/ratelimit.ts`

---

### **❌ MISSING (1 variable)**

#### **4. Sentry Error Tracking (OPTIONAL but recommended)**
```bash
❌ NEXT_PUBLIC_SENTRY_DSN                    # MISSING
```
**Used in:** `src/instrumentation.ts`, `src/instrumentation-client.ts`

**Impact if missing:**
- ⚠️ Error tracking won't work
- ⚠️ You won't get notified of production errors
- ✅ App will still function normally (Sentry is optional)

**Where to get it:**
1. Go to [sentry.io](https://sentry.io)
2. Create a free account
3. Create a new Next.js project
4. Copy the DSN from project settings

---

## 🔍 **Variable Usage Breakdown**

### **Firebase (6 variables) - CRITICAL**
| Variable | Used In | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | firebase.ts, analyze route | Firebase authentication |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | firebase.ts | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | firebase.ts, og route, analyze route | Project identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | firebase.ts | File storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | firebase.ts | Cloud messaging |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | firebase.ts, analyze route | App identifier |

**Status:** ✅ All present and configured

---

### **Groq AI (1 variable) - CRITICAL**
| Variable | Used In | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | analyze route, compare route | AI analysis API |

**Status:** ✅ Present and configured

**Note:** Your app validates this on startup in `src/instrumentation.ts`

---

### **Upstash Redis (2 variables) - CRITICAL**
| Variable | Used In | Purpose |
|----------|---------|---------|
| `UPSTASH_REDIS_REST_URL` | redis.ts, ratelimit.ts | Redis connection |
| `UPSTASH_REDIS_REST_TOKEN` | redis.ts, ratelimit.ts | Redis authentication |

**Status:** ✅ Present and configured

**Note:** Your app validates this on startup in `src/instrumentation.ts`

---

### **Sentry (1 variable) - OPTIONAL**
| Variable | Used In | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | instrumentation.ts, instrumentation-client.ts | Error tracking |

**Status:** ❌ Missing (but optional)

**Impact:** Error tracking disabled, but app works fine

---

## 🎯 **Recommendations**

### **1. Add Sentry DSN (Recommended)**

Add this to your `.env.local`:

```bash
# Sentry Error Tracking (Optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
```

**Benefits:**
- ✅ Get notified of production errors
- ✅ Track error frequency and patterns
- ✅ See stack traces and user context
- ✅ Free tier available (5,000 errors/month)

**How to get it:**
1. Sign up at [sentry.io](https://sentry.io)
2. Create a Next.js project
3. Copy the DSN from Settings → Client Keys (DSN)

---

### **2. Update .env.example**

Your `.env.example` is outdated. Update it to match what's actually used:

```bash
# Firebase Configuration (Required)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Groq AI API (Required)
GROQ_API_KEY=your_groq_api_key

# Upstash Redis (Required)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Sentry Error Tracking (Optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

---

## ⚠️ **Issues Found**

### **1. Outdated Variable Name in .env.example**
```bash
# .env.example has:
GOOGLE_GENERATION_AI_API_KEY=your_api_key_here

# But your code doesn't use this!
# It's been replaced by GROQ_API_KEY
```

**Action:** Remove `GOOGLE_GENERATION_AI_API_KEY` from `.env.example`

### **2. Extra Variable in .env.local**
```bash
# .env.local has:
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyB1rH9gvCxmYKRN7mfyYbydXhq2ZrG8-4k

# This is NOT used anywhere in your code
```

**Action:** You can remove this (it's from an old version)

---

## 🔒 **Security Check**

### **✅ Good Practices:**
- All sensitive variables are in `.env.local` (not committed)
- Using `NEXT_PUBLIC_` prefix for client-side variables correctly
- Server-only secrets (GROQ_API_KEY, UPSTASH) don't have `NEXT_PUBLIC_` prefix

### **⚠️ Note on NEXT_PUBLIC_ Variables:**
Variables with `NEXT_PUBLIC_` prefix are **exposed to the browser**. This is OK for:
- ✅ Firebase config (designed to be public)
- ✅ Sentry DSN (designed to be public)

But NOT OK for:
- ❌ API keys that should be secret (like GROQ_API_KEY)
- ❌ Database credentials
- ❌ Private tokens

**Your setup is correct!** ✅

---

## 📊 **Summary**

| Category | Required | Present | Missing | Status |
|----------|----------|---------|---------|--------|
| **Firebase** | 6 | 6 | 0 | ✅ Complete |
| **Groq AI** | 1 | 1 | 0 | ✅ Complete |
| **Upstash Redis** | 2 | 2 | 0 | ✅ Complete |
| **Sentry** | 0 (optional) | 0 | 1 | ⚠️ Optional |
| **Unused** | 0 | 1 | - | 🧹 Can remove |
| **TOTAL** | 9 | 10 | 1 | ✅ 90% Complete |

---

## ✅ **Action Items**

### **High Priority:**
1. ✅ All critical variables are present - **No action needed**

### **Recommended:**
1. ⚠️ Add `NEXT_PUBLIC_SENTRY_DSN` for error tracking
2. 🧹 Remove unused `GOOGLE_GENERATIVE_AI_API_KEY` from `.env.local`
3. 📝 Update `.env.example` to match current variables

### **Optional:**
1. 📚 Document what each variable does in `.env.example`

---

## 🎉 **Conclusion**

**Your `.env.local` has everything needed for the app to function!**

The only missing variable is `NEXT_PUBLIC_SENTRY_DSN`, which is optional. Your app will work perfectly without it, but you won't get error tracking in production.

**App Status:** ✅ **Fully Functional**

**Recommendation:** Add Sentry DSN for production error monitoring.
