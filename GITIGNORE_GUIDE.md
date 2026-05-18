# .gitignore Guide - Critical Security & Best Practices 🔒

**Date:** May 18, 2026  
**Project:** ToS Analyser

---

## 🚨 **CRITICAL - NEVER COMMIT THESE**

These files contain secrets and MUST be in `.gitignore`:

### **1. Environment Variables**
```
.env.local                    # ⚠️ CONTAINS API KEYS & SECRETS
.env.development.local
.env.test.local
.env.production.local
```

**Why Critical:**
- Contains Firebase API keys
- Contains Groq API key
- Contains Upstash Redis credentials
- Contains Sentry DSN
- If leaked, attackers can:
  - Access your database
  - Use your AI quota
  - Rack up bills on your account
  - Delete your data

**What to commit instead:**
- ✅ `.env.example` - Template without actual secrets

---

### **2. Firebase Service Account Keys**
```
*-firebase-adminsdk-*.json    # ⚠️ FULL DATABASE ACCESS
serviceAccountKey.json
firebase-debug.log
firebaseServiceAccount.json
```

**Why Critical:**
- Grants FULL admin access to Firebase
- Can read/write/delete ALL data
- Can modify security rules
- Can access user authentication data
- If leaked, your entire database is compromised

**Never download these to your project!**
- Use Firebase Admin SDK with environment variables instead
- Store service account keys in secure secret managers (Vercel, Railway, etc.)

---

### **3. SSL Certificates & Private Keys**
```
*.pem                         # ⚠️ PRIVATE KEYS
*.key
*.cert
*.crt
*.p12
*.pfx
```

**Why Critical:**
- Private keys for SSL/TLS encryption
- If leaked, attackers can impersonate your server
- Can decrypt encrypted traffic

---

## ✅ **SHOULD BE IGNORED - Build Artifacts**

These are generated files that should not be committed:

### **Build Output**
```
/.next/                       # Next.js build output
/out/                         # Next.js static export
/build/                       # Production build
*.tsbuildinfo                 # TypeScript incremental build
```

**Why:**
- Generated on every build
- Large file sizes
- Different on each machine
- Regenerated during deployment

---

### **Dependencies**
```
/node_modules/                # npm packages
```

**Why:**
- Extremely large (100,000+ files)
- Regenerated with `npm install`
- Specified in package-lock.json
- Different per OS/architecture

---

### **Logs & Debug Files**
```
npm-debug.log*
yarn-debug.log*
*.log
firebase-debug.log
```

**Why:**
- Temporary debugging information
- Can contain sensitive data
- Generated during errors
- Not needed in repository

---

## 🎯 **RECOMMENDED - Development Files**

These are personal preference files:

### **Editor Settings**
```
.vscode/*                     # VS Code settings
.idea/                        # JetBrains IDEs
*.sublime-workspace           # Sublime Text
```

**Options:**
1. **Ignore all** - Each developer uses their own settings
2. **Commit shared settings** - Team uses same formatting/linting

**Current setup:** Ignores all except specific VS Code files

---

### **AI Assistant Files**
```
.gemini/                      # Gemini AI workspace
.cursor/                      # Cursor AI
CLAUDE.md                     # Claude instructions
AGENTS.md                     # Agent instructions
```

**Why:**
- Personal AI assistant data
- Not part of the application
- Different per developer

---

### **Temporary Files**
```
scratch/                      # Test/scratch files
temp/
tmp/
*.tmp
*.bak
*.diff
*.patch
lint_output*.txt
```

**Why:**
- Temporary testing
- Not part of production code
- Can be recreated

---

## 📋 **CURRENT .gitignore BREAKDOWN**

### **✅ What's Protected:**

| Category | Files | Risk Level |
|----------|-------|------------|
| **Secrets** | `.env.local`, Firebase keys | 🔴 CRITICAL |
| **Build Output** | `.next/`, `*.tsbuildinfo` | 🟡 Medium |
| **Dependencies** | `node_modules/` | 🟡 Medium |
| **Logs** | `*.log`, debug files | 🟢 Low |
| **Editor** | `.vscode/`, `.idea/` | 🟢 Low |
| **Temporary** | `scratch/`, `*.tmp` | 🟢 Low |

---

## 🔍 **How to Check What's Ignored**

### **Check if a file is ignored:**
```bash
git check-ignore -v filename.txt
```

### **List all ignored files:**
```bash
git status --ignored
```

### **See what would be committed:**
```bash
git status
```

---

## ⚠️ **Common Mistakes to Avoid**

### **1. Committing .env.local**
```bash
# ❌ WRONG - This commits your secrets!
git add .env.local
git commit -m "Add env file"

# ✅ RIGHT - Only commit the template
git add .env.example
git commit -m "Add env template"
```

### **2. Committing node_modules**
```bash
# ❌ WRONG - Huge commit, will fail
git add node_modules/

# ✅ RIGHT - Already ignored, use package.json
git add package.json package-lock.json
```

### **3. Committing Firebase keys**
```bash
# ❌ WRONG - Full database access leaked!
git add serviceAccountKey.json

# ✅ RIGHT - Use environment variables instead
# Store in Vercel/Railway secret manager
```

---

## 🛡️ **Security Best Practices**

### **1. Never Commit Secrets**
- Use `.env.local` for local development
- Use secret managers for production (Vercel, Railway, etc.)
- Rotate keys immediately if accidentally committed

### **2. Use .env.example**
```bash
# .env.example (safe to commit)
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
UPSTASH_REDIS_REST_URL=your_url_here

# .env.local (NEVER commit)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...actual_key
GROQ_API_KEY=gsk_...actual_key
UPSTASH_REDIS_REST_URL=https://...actual_url
```

### **3. Check Before Committing**
```bash
# Always review what you're committing
git status
git diff --cached

# Check for secrets
git diff --cached | grep -i "api_key\|secret\|password"
```

### **4. Use Git Hooks (Optional)**
Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Prevent committing .env files
if git diff --cached --name-only | grep -q "\.env\.local"; then
    echo "❌ Error: Attempting to commit .env.local"
    echo "This file contains secrets and should not be committed!"
    exit 1
fi
```

---

## 🚨 **If You Accidentally Commit Secrets**

### **Immediate Actions:**

1. **Rotate ALL compromised credentials immediately**
   - Firebase: Regenerate API keys
   - Groq: Regenerate API key
   - Upstash: Regenerate tokens

2. **Remove from Git history**
   ```bash
   # Remove file from history (use with caution!)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (if already pushed)
   git push origin --force --all
   ```

3. **Notify your team**
   - All keys have been rotated
   - Update their local `.env.local` files

4. **Check for unauthorized access**
   - Firebase: Check authentication logs
   - Upstash: Check Redis access logs
   - Groq: Check API usage

---

## 📊 **File Size Impact**

| What to Ignore | Typical Size | Why |
|----------------|--------------|-----|
| `node_modules/` | 200-500 MB | Dependencies |
| `.next/` | 50-200 MB | Build output |
| `.env.local` | < 1 KB | **Contains secrets!** |
| `*.log` | 1-10 MB | Debug logs |
| `.tsbuildinfo` | 1-5 MB | Build cache |

**Total saved:** ~300-700 MB per commit!

---

## ✅ **Verification Checklist**

Before pushing to GitHub:

- [ ] `.env.local` is in `.gitignore`
- [ ] No Firebase service account keys in repo
- [ ] No `node_modules/` committed
- [ ] No `.next/` build output committed
- [ ] `.env.example` exists (without real secrets)
- [ ] Run `git status` to verify
- [ ] Check `git diff --cached` before commit

---

## 🎓 **Quick Reference**

### **Files You MUST Ignore:**
```
.env.local                    # API keys & secrets
*-firebase-adminsdk-*.json    # Firebase admin keys
*.pem, *.key                  # Private keys
```

### **Files You SHOULD Ignore:**
```
node_modules/                 # Dependencies
.next/                        # Build output
*.log                         # Logs
*.tsbuildinfo                 # Build cache
```

### **Files You CAN Commit:**
```
.env.example                  # Template (no secrets)
package.json                  # Dependencies list
package-lock.json             # Locked versions
src/                          # Source code
public/                       # Static assets
```

---

## 🔗 **Additional Resources**

- [GitHub's .gitignore templates](https://github.com/github/gitignore)
- [Next.js .gitignore best practices](https://nextjs.org/docs)
- [Firebase security best practices](https://firebase.google.com/docs/rules)
- [Git secrets detection tools](https://github.com/awslabs/git-secrets)

---

**Your .gitignore is now configured for maximum security and efficiency!** 🎉

**Remember:** When in doubt, DON'T commit it. You can always add files later, but removing secrets from Git history is difficult and dangerous.
