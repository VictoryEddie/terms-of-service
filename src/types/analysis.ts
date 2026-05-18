export interface Risk {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  quote?: string;
}

export interface GoodPoint {
  title: string;
  description: string;
}

export interface SmokingGun {
  title: string;
  description: string;
  clause: string;
}

export interface AnalysisResult {
  id?: string;
  isTermsOfService: boolean;
  appName?: string;
  transparencyScore?: number;
  grade?: string;
  summary: string;
  risks: Risk[];
  goodPoints: GoodPoint[];
  timeSavedMinutes?: number;
  smokingGun?: SmokingGun | null;
  jurisdiction?: string;
  contentHash?: string;
  previousVersionId?: string | null;
  analysisSource?: "link" | "text";
  sourceUrl?: string | null;
}
