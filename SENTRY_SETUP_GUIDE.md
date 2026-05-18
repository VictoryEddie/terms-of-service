# Sentry Setup Guide 🔍

**Quick guide to add error tracking to your ToS Analyser**

---

## 🎯 **What is Sentry?**

Sentry is an error tracking service that:
- ✅ Captures errors in production
- ✅ Shows you stack traces
- ✅ Tracks error frequency
- ✅ Notifies you when errors occur
- ✅ Shows user context (browser, OS, etc.)

**Free Tier:** 5,000 errors/month (plenty for most apps!)

---

## 🚀 **Quick Setup (5 minutes)**

### **Step 1: Create Sentry Account**

1. Go to [sentry.io](https://sentry.io)
2. Click "Get Started" or "Sign Up"
3. Sign up with GitHub, Google, or email

---

### **Step 2: Create a Project**

1. After signing in, click "Create Project"
2. Select **"Next.js"** as the platform
3. Set alert frequency (default is fine)
4. Name your project: `tos-analyser`
5. Click "Create Project"

---

### **Step 3: Get Your DSN**

After creating the project, you'll see a setup page with your DSN.

**It looks like this:**
```
https://1234567890abcdef@o123456.ingest.sentry.io/1234567
```

**Copy this DSN!**

---

### **Step 4: Add DSN to .env.local**

Open your `.env.local` file and add:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-actual-dsn@sentry.io/your-project-id
```

**Example:**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://1234567890abcdef@o123456.ingest.sentry.io/1234567
```

---

### **Step 5: Restart Your Dev Server**

```bash
# Stop your dev server (Ctrl+C)
# Then restart it
npm run dev
```

---

## ✅ **Verify It's Working**

### **Test Error Tracking:**

1. Open your app in the browser
2. Open browser console (F12)
3. Type this to trigger a test error:
   ```javascript
   throw new Error("Test error for Sentry");
   ```
4. Go to your Sentry dashboard
5. You should see the error appear within a few seconds!

---

## 🎯 **What Sentry Will Track**

### **Automatically Captured:**
- ✅ Unhandled JavaScript errors
- ✅ Unhandled promise rejections
- ✅ React component errors (via Error Boundary)
- ✅ API route errors
- ✅ Navigation errors

### **Manually Captured (Already in Your Code):**
```typescript
// In src/app/page.tsx
Sentry.captureException(error, {
  tags: { action: "save_report" },
  extra: { userId: user.uid, contentHash: object.contentHash }
});

// In src/components/ErrorBoundary.tsx
Sentry.captureException(error, {
  contexts: {
    react: {
      componentStack: errorInfo.componentStack,
    },
  },
});
```

---

## 📊 **What You'll See in Sentry**

### **Error Details:**
- Error message and stack trace
- Browser and OS information
- User actions leading to error
- Frequency and affected users
- Source code context

### **Example Error:**
```
Error: Failed to save report
  at handleSave (page.tsx:127)
  at onClick (page.tsx:145)

Browser: Chrome 120.0
OS: Windows 11
User: user@example.com
Timestamp: 2026-05-18 14:30:45
```

---

## 🔔 **Configure Alerts (Optional)**

### **Email Notifications:**
1. Go to Sentry → Settings → Alerts
2. Create a new alert rule
3. Set conditions (e.g., "When an error occurs")
4. Add your email
5. Save

### **Slack Integration:**
1. Go to Sentry → Settings → Integrations
2. Find Slack
3. Click "Install"
4. Choose your Slack workspace
5. Select channel for notifications

---

## 🎨 **Sentry Dashboard Features**

### **Issues Tab:**
- See all errors
- Filter by status (unresolved, resolved, ignored)
- Sort by frequency or recency

### **Performance Tab:**
- See slow API routes
- Track page load times
- Identify bottlenecks

### **Releases Tab:**
- Track errors by deployment
- See which version introduced bugs
- Compare error rates between versions

---

## 🔒 **Privacy & Security**

### **What Sentry Collects:**
- ✅ Error messages and stack traces
- ✅ Browser and OS info
- ✅ Page URLs
- ✅ User actions (breadcrumbs)

### **What Sentry DOESN'T Collect:**
- ❌ Passwords or sensitive form data
- ❌ Full page content
- ❌ Private user data (unless you explicitly send it)

### **Your Current Setup:**
Your code already includes user context:
```typescript
Sentry.captureException(error, {
  extra: { userId: user.uid }  // Only user ID, not email/password
});
```

This is safe and helps you debug user-specific issues.

---

## 💰 **Pricing**

### **Free Tier (Developer):**
- ✅ 5,000 errors/month
- ✅ 1 user
- ✅ 30-day history
- ✅ All core features

**Perfect for:**
- Personal projects
- Small apps
- Testing and development

### **Paid Tiers:**
- **Team:** $26/month - 50,000 errors/month
- **Business:** $80/month - 100,000 errors/month

**You'll likely stay on free tier!**

---

## 🚀 **Deploy to Vercel**

### **Add DSN to Vercel:**

1. Go to your Vercel project
2. Settings → Environment Variables
3. Add:
   ```
   Name: NEXT_PUBLIC_SENTRY_DSN
   Value: https://your-dsn@sentry.io/your-project
   ```
4. Select all environments (Production, Preview, Development)
5. Save

### **Redeploy:**
```bash
git push
```

Vercel will automatically redeploy with Sentry enabled!

---

## 🎯 **Best Practices**

### **1. Don't Over-Log**
```typescript
// ❌ BAD - Logs every click
onClick={() => Sentry.captureMessage("Button clicked")}

// ✅ GOOD - Only logs errors
onClick={() => {
  try {
    doSomething();
  } catch (error) {
    Sentry.captureException(error);
  }
}}
```

### **2. Add Context**
```typescript
// ❌ BAD - No context
Sentry.captureException(error);

// ✅ GOOD - With context
Sentry.captureException(error, {
  tags: { action: "save_report" },
  extra: { reportId: report.id }
});
```

### **3. Use Error Boundaries**
Your app already has this! ✅
```typescript
// src/components/ErrorBoundary.tsx
componentDidCatch(error, errorInfo) {
  Sentry.captureException(error, {
    contexts: { react: { componentStack: errorInfo.componentStack } }
  });
}
```

---

## 🐛 **Common Issues**

### **"Sentry not capturing errors"**

**Check:**
1. DSN is correct in `.env.local`
2. Dev server was restarted after adding DSN
3. Error actually occurred (check browser console)
4. Sentry project is active (not paused)

**Test:**
```javascript
// In browser console
throw new Error("Test Sentry");
```

---

### **"Too many errors"**

**Solutions:**
1. Filter out known errors:
   ```typescript
   Sentry.init({
     beforeSend(event) {
       if (event.message?.includes("ResizeObserver")) {
         return null; // Don't send this error
       }
       return event;
     }
   });
   ```

2. Set sample rate:
   ```typescript
   Sentry.init({
     tracesSampleRate: 0.1, // Only 10% of errors
   });
   ```

---

## ✅ **Checklist**

- [ ] Created Sentry account
- [ ] Created Next.js project in Sentry
- [ ] Copied DSN
- [ ] Added DSN to `.env.local`
- [ ] Restarted dev server
- [ ] Tested with a sample error
- [ ] Saw error in Sentry dashboard
- [ ] Added DSN to Vercel environment variables
- [ ] Deployed to production

---

## 🎉 **You're Done!**

Sentry is now tracking errors in your app. You'll get notified when things break, and you'll have all the context you need to fix them quickly.

**Next Steps:**
1. Set up email alerts
2. Integrate with Slack (optional)
3. Configure custom error messages
4. Set up release tracking

---

## 📚 **Resources**

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Error Tracking Best Practices](https://docs.sentry.io/product/issues/)

---

**Happy error tracking! 🐛🔍**
