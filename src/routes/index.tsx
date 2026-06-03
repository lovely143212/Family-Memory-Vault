import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Vault, Shield, Bell, Users, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Family Vault — Secure Digital Memory for Your Family" },
      { name: "description", content: "Store, organize and share important family documents with bank-grade security. Automatic expiry reminders, AI extraction, and role-based family access." },
      { property: "og:title", content: "Family Vault — Secure Digital Memory" },
      { property: "og:description", content: "Everything important your family owns, in one secure vault." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Vault className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">Family Vault</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-12 pb-20 md:pt-24 md:pb-32">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Now with AI document extraction
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-6xl">
              Your family's <span className="text-primary">digital memory</span>, in one secure vault.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Store passports, insurance, deeds, medical records and bills. Get reminded before anything expires. Share access with the people you trust.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Create your vault</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary"/>Bank-grade encryption</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary"/>Role-based family access</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent blur-2xl" />
            <div className="relative grid gap-4 rounded-3xl border bg-surface-elevated p-6 shadow-xl">
              {[
                { icon: FileText, t: "Passport — John", d: "Expires Mar 2029" },
                { icon: Shield, t: "Home Insurance", d: "Renews in 12 days" },
                { icon: Bell, t: "Vehicle Registration", d: "Reminder set" },
              ].map((c) => (
                <div key={c.t} className="flex items-center gap-3 rounded-2xl border bg-surface p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{c.t}</div>
                    <div className="text-sm text-muted-foreground">{c.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, t: "AI document extraction", d: "Snap a photo — we'll detect names, numbers and expiry dates automatically." },
            { icon: Bell, t: "Never miss a renewal", d: "Get notified before passports, insurance, or registrations expire." },
            { icon: Users, t: "Built for families", d: "Owner, Editor, Viewer roles so the right people see the right docs." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border bg-surface-elevated p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-surface py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Family Vault. Your memories, secured.
      </footer>
    </div>
  );
}
