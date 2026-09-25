import * as admin from "firebase-admin";

const globalForAdmin = globalThis as unknown as {
  firebaseAdminApp?: admin.app.App;
  adminFirestore?: admin.firestore.Firestore;
  adminInitialized?: boolean;
};

function hasAnyAdminConfig(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_PRIVATE_KEY)
  ) {
    return true;
  }
  return false;
}

function getAdminApp(): admin.app.App | null {
  if (globalForAdmin.adminInitialized) {
    return globalForAdmin.firebaseAdminApp ?? null;
  }
  globalForAdmin.adminInitialized = true;

  if (!hasAnyAdminConfig()) {
    console.warn(
      "[Firebase Admin] No service-account credentials configured. " +
        "L3 (Firestore) global_cache writes are disabled. " +
        "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY to enable."
    );
    return null;
  }

  try {
    const existing = admin.apps.find((a) => a?.name === "[DEFAULT]");
    if (existing) {
      globalForAdmin.firebaseAdminApp = existing;
      return existing;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId:
          process.env.FIREBASE_ADMIN_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
          undefined,
      });
      globalForAdmin.firebaseAdminApp = app;
      return app;
    }

    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY || "";
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    });

    globalForAdmin.firebaseAdminApp = app;
    return app;
  } catch (err) {
    console.error("[Firebase Admin] Failed to initialize admin SDK. L3 writes disabled:", err);
    return null;
  }
}

export function getAdminFirestore(): admin.firestore.Firestore | null {
  if (globalForAdmin.adminFirestore) return globalForAdmin.adminFirestore;
  const app = getAdminApp();
  if (!app) return null;
  try {
    const fs = app.firestore();
    globalForAdmin.adminFirestore = fs;
    return fs;
  } catch (err) {
    console.error("[Firebase Admin] Failed to obtain Firestore instance:", err);
    return null;
  }
}

export function isAdminFirestoreAvailable(): boolean {
  return getAdminFirestore() !== null;
}
