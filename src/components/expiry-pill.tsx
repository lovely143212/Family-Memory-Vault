import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export function ExpiryPill({ date, className }: { date?: string | null; className?: string }) {
  if (!date) return <span className={cn("text-xs text-muted-foreground", className)}>No expiry</span>;
  const days = differenceInDays(parseISO(date), new Date());
  let tone = "bg-muted text-muted-foreground";
  let label = `Expires in ${days} days`;
  if (days < 0) { tone = "bg-danger/10 text-danger"; label = `Expired ${-days}d ago`; }
  else if (days <= 30) tone = "bg-warning/15 text-warning";
  else tone = "bg-success/15 text-success";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone, className)}>{label}</span>;
}