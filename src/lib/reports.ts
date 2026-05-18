import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { AnalysisResult } from "@/types/analysis";

export async function saveReport(userId: string, result: AnalysisResult) {
  try {
    console.log("Saving report for user:", userId);
    const docRef = await addDoc(collection(db, "users", userId, "reports"), {
      ...result,
      createdAt: serverTimestamp(),
    });
    console.log("Report saved successfully with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("CRITICAL FIREBASE ERROR:", error);
    throw error;
  }
}
