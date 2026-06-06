import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Download, RotateCw, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  mimeType: string | null | undefined;
  title: string;
  onDownload?: () => void;
};

const isImage = (m?: string | null) => !!m && (m.startsWith("image/"));
const isPdf = (m?: string | null) => m === "application/pdf";

export function DocumentViewer({ url, mimeType, title, onDownload }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    function onFs() { setFs(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFullscreen() {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current.requestFullscreen?.();
  }

  function download() {
    if (onDownload) return onDownload();
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  const supported = isImage(mimeType) || isPdf(mimeType);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border bg-surface-elevated"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface px-3 py-2">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="flex items-center gap-1">
          {isImage(mimeType) && (
            <>
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} aria-label="Zoom out"><ZoomOut className="h-4 w-4"/></Button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))} aria-label="Zoom in"><ZoomIn className="h-4 w-4"/></Button>
              <Button size="icon" variant="ghost" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate"><RotateCw className="h-4 w-4"/></Button>
            </>
          )}
          <Button size="icon" variant="ghost" onClick={download} aria-label="Download"><Download className="h-4 w-4"/></Button>
          <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Fullscreen">
            {fs ? <Minimize2 className="h-4 w-4"/> : <Maximize2 className="h-4 w-4"/>}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-muted/40">
        {isImage(mimeType) && (
          <div className="flex min-h-full items-center justify-center p-4">
            <img
              src={url}
              alt={title}
              draggable={false}
              className="select-none transition-transform duration-150 will-change-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                maxWidth: "100%",
                maxHeight: "85vh",
              }}
            />
          </div>
        )}
        {isPdf(mimeType) && (
          <iframe
            src={`${url}#toolbar=1&view=FitH`}
            title={title}
            className="h-full w-full"
            style={{ minHeight: fs ? "100vh" : "70vh" }}
          />
        )}
        {!supported && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
            <FileWarning className="h-8 w-8"/>
            <p>Preview not supported for this file type.</p>
            <Button onClick={download} variant="outline"><Download className="mr-2 h-4 w-4"/>Download to view</Button>
          </div>
        )}
      </div>
    </div>
  );
}