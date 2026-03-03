"use client";

import { useState, useRef } from "react";
import { Loader2, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RuntimeIframeProps {
  url: string;
  instanceId: string;
}

export function RuntimeIframe({ url, instanceId }: RuntimeIframeProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handleRefresh() {
    setLoaded(false);
    setErrored(false);
    setKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Iframe toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 bg-zinc-800 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-400 max-w-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="truncate">{url}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="shrink-0"
          title="Reload runtime"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="shrink-0" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </a>
      </div>

      {/* Iframe body */}
      <div className="relative flex-1">
        {/* Loading overlay */}
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-tulip-400" />
            <p className="text-sm text-zinc-500">
              Connecting to{" "}
              <span className="font-mono text-zinc-400">{instanceId}</span>…
            </p>
          </div>
        )}

        {/* Error state */}
        {errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 gap-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-zinc-200">
                Could not load runtime
              </p>
              <p className="text-xs text-zinc-500">
                The runtime may still be starting up. Try refreshing in a moment.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleRefresh}>
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        )}

        <iframe
          key={key}
          ref={iframeRef}
          src={url}
          className={cn(
            "w-full h-full border-0 bg-zinc-950",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => {
            setLoaded(true);
            setErrored(false);
          }}
          onError={() => {
            setErrored(true);
            setLoaded(false);
          }}
          title={`OpenClaw runtime — ${instanceId}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
