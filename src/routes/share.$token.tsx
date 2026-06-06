import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { resolveShare } from "@/lib/shares.functions";
import { DocumentViewer } from "@/components/document-viewer";
import { Vault, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/share/$token")({
  head: () => ({ meta: [{ title: "Shared document — Family Vault" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const resolve = useServerFn(resolveShare);
  const q = useQuery({
    queryKey: ["share", token],
    queryFn: () => resolve({ data: { token } }),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-surface px-4 py-3">
        <Vault className="h-5 w-5 text-primary"/>
        <span className="font-display font-semibold">Family Vault</span>
        <span className="ml-auto text-xs text-muted-foreground">Secure share link</span>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        {q.isLoading && <p className="p-10 text-center text-muted-foreground">Loading…</p>}
        {q.data?.ok === false && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <ShieldAlert className="h-10 w-10 text-danger"/>
            <h1 className="font-display text-xl font-semibold text-foreground">Link unavailable</h1>
            <p>{q.data.error}</p>
          </div>
        )}
        {q.data?.ok && (
          <div className="h-[80vh]">
            <DocumentViewer url={q.data.url} mimeType={q.data.mime_type} title={q.data.title}/>
          </div>
        )}
      </main>
    </div>
  );
}