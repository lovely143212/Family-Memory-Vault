import type { CategoryValue } from "./categories";

/**
 * Emergency quick-access tags. Each entry knows how to recognise a matching
 * document by title/number keywords, plus a default category fallback.
 */
export type QuickAccessKey = "aadhaar" | "pan" | "passport" | "license" | "insurance";

export const QUICK_ACCESS: {
  key: QuickAccessKey;
  label: string;
  short: string;
  category: CategoryValue;
  keywords: string[];
}[] = [
  { key: "aadhaar", label: "Aadhaar", short: "AAD", category: "identity", keywords: ["aadhaar", "aadhar", "uidai"] },
  { key: "pan", label: "PAN Card", short: "PAN", category: "identity", keywords: ["pan card", "pan number", "permanent account"] },
  { key: "passport", label: "Passport", short: "PSP", category: "identity", keywords: ["passport"] },
  { key: "license", label: "Driving License", short: "DL", category: "vehicles", keywords: ["driving license", "driver license", "licence", "license"] },
  { key: "insurance", label: "Insurance", short: "INS", category: "insurance", keywords: ["insurance", "policy", "mediclaim"] },
];

export function matchQuickAccess(doc: { title: string; category: string; document_number?: string | null }, key: QuickAccessKey) {
  const cfg = QUICK_ACCESS.find((q) => q.key === key);
  if (!cfg) return false;
  const hay = `${doc.title} ${doc.document_number ?? ""}`.toLowerCase();
  if (cfg.keywords.some((k) => hay.includes(k))) return true;
  // Fall back to category if title doesn't mention it explicitly
  return false;
}

export function bestMatchForKey<T extends { title: string; category: string; document_number?: string | null }>(docs: T[], key: QuickAccessKey): T | undefined {
  const cfg = QUICK_ACCESS.find((q) => q.key === key);
  if (!cfg) return undefined;
  const direct = docs.find((d) => matchQuickAccess(d, key));
  if (direct) return direct;
  return docs.find((d) => d.category === cfg.category);
}