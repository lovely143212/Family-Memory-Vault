import { FileText, Home, Shield, HeartPulse, GraduationCap, Receipt, Car, Folder } from "lucide-react";

export const CATEGORIES = [
  { value: "identity", label: "Identity", icon: FileText, color: "#3b82f6" },
  { value: "property", label: "Property", icon: Home, color: "#0ea5e9" },
  { value: "insurance", label: "Insurance", icon: Shield, color: "#8b5cf6" },
  { value: "medical", label: "Medical", icon: HeartPulse, color: "#ef4444" },
  { value: "education", label: "Education", icon: GraduationCap, color: "#f59e0b" },
  { value: "bills", label: "Bills", icon: Receipt, color: "#10b981" },
  { value: "vehicles", label: "Vehicles", icon: Car, color: "#f97316" },
  { value: "other", label: "Other", icon: Folder, color: "#64748b" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function getCategory(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}