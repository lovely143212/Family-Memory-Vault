import { Link } from "@tanstack/react-router";
import { Fingerprint, IdCard, Plane, Car, ShieldCheck, Upload } from "lucide-react";
import { type QuickAccessKey, QUICK_ACCESS, bestMatchForKey } from "@/lib/quick-access";

const ICONS: Record<QuickAccessKey, React.ComponentType<{ className?: string }>> = {
  aadhaar: Fingerprint,
  pan: IdCard,
  passport: Plane,
  license: Car,
  insurance: ShieldCheck,
};

type Doc = { id: string; title: string; category: string; document_number: string | null };

export function QuickAccessGrid({ docs }: { docs: Doc[] }) {
  return (
    <section className="rounded-2xl border bg-gradient-to-br from-primary-soft to-surface-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Emergency quick access</h2>
          <p className="text-xs text-muted-foreground">One tap to open your essentials.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_ACCESS.map((q) => {
          const Icon = ICONS[q.key];
          const match = bestMatchForKey(docs, q.key);
          const content = (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border bg-surface-elevated p-4 text-center transition active:scale-[0.98]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon className="h-5 w-5"/>
              </div>
              <div className="text-sm font-semibold">{q.label}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {match ? "Tap to open" : (
                  <span className="inline-flex items-center gap-1 text-warning"><Upload className="h-3 w-3"/>Add document</span>
                )}
              </div>
            </div>
          );
          return match ? (
            <Link key={q.key} to="/documents/$id" params={{ id: match.id }} className="block">
              {content}
            </Link>
          ) : (
            <Link key={q.key} to="/upload" className="block">{content}</Link>
          );
        })}
      </div>
    </section>
  );
}