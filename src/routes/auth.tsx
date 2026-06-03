import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Vault } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Family Vault" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Check your inbox to confirm your email.");
  }

  async function googleSignIn() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (res.error) toast.error(res.error.message || "Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-primary-soft via-background to-surface p-12 lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Vault className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">Family Vault</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">Your family's documents, organized and protected.</h2>
          <p className="mt-4 max-w-md text-muted-foreground">End-to-end encryption, automatic expiry reminders, and role-based access for the people you trust.</p>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Family Vault</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Vault className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">Family Vault</span>
          </Link>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6 space-y-4">
              <h1 className="font-display text-2xl font-bold">Welcome back</h1>
              <Button onClick={googleSignIn} variant="outline" className="w-full">Continue with Google</Button>
              <div className="relative my-4 text-center text-xs text-muted-foreground"><span className="bg-background px-2">or email</span><div className="absolute left-0 top-1/2 -z-0 h-px w-full bg-border"/></div>
              <form onSubmit={signIn} className="space-y-3">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <h1 className="font-display text-2xl font-bold">Create your vault</h1>
              <Button onClick={googleSignIn} variant="outline" className="w-full">Continue with Google</Button>
              <div className="relative my-4 text-center text-xs text-muted-foreground"><span className="bg-background px-2">or email</span><div className="absolute left-0 top-1/2 -z-0 h-px w-full bg-border"/></div>
              <form onSubmit={signUp} className="space-y-3">
                <div><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}