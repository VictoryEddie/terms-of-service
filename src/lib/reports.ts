import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { AnalysisResult } from "@/types/analysis";
import { logger, hashIp } from "@/lib/logging";

export async function saveReport(userId: string, result: AnalysisResult) {
  try {
    logger.debug("Saving report for user", { userIdHash: hashIp(userId) });
    const docRef = await addDoc(collection(db, "users", userId, "reports"), {
      ...result,
      createdAt: serverTimestamp(),
    });
    logger.info("Report saved successfully", { docId: docRef.id });
    return docRef.id;
  } catch (error) {
    logger.error("CRITICAL FIREBASE ERROR in saveReport:", error);
    throw error;
  }
}
