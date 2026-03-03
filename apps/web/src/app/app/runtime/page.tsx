"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserOrg, useRuntime, useSlackIntegration } from "@/lib/hooks/useOrg";
import { RuntimeIframe } from "@/components/runtime/RuntimeIframe";
import { ProvisionPanel } from "@/components/runtime/ProvisionPanel";
import { StatusBadge } from "@/components/ui/badge";
import { Loader2, LayoutGrid, SplitSquareVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

type ViewMode = "split" | "full";

export default function RuntimePage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useUserOrg(user?.uid);
  const { runtime, loading: runtimeLoading } = useRuntime(org?.id);
  const { slack } = useSlackIntegration(org?.id);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [refreshKey, setRefreshKey] = useState(0);

  const isReady = runtime?.status === "ready";

  if (orgLoading || runtimeLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      <Toaster position="top-right" toastOptions={{ className: "!bg-zinc-800 !text-zinc-100 !border !border-zinc-700" }} />

      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-zinc-200">Runtime</h1>
          {runtime && <StatusBadge status={runtime.status} />}
          {runtime && (
            <code className="text-xs text-zinc-600 font-mono hidden sm:block">
              {runtime.instanceId}
            </code>
          )}
        </div>

        {isReady && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            {(
              [
                { mode: "split" as ViewMode, icon: SplitSquareVertical, label: "Split view" },
                { mode: "full" as ViewMode, icon: LayoutGrid, label: "Full iframe" },
              ] as const
            ).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === mode
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!isReady ? (
        // Show provision panel when not ready
        <div className="flex-1 overflow-y-auto">
          <ProvisionPanel
            runtime={runtime}
            hasSlack={Boolean(slack)}
            onProvisioned={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      ) : viewMode === "full" ? (
        // Full iframe
        <div className="flex-1 overflow-hidden">
          <RuntimeIframe
            key={refreshKey}
            url={`https://${runtime.subdomain}`}
            instanceId={runtime.instanceId}
          />
        </div>
      ) : (
        // Split: info panel left, iframe right
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800">
            <ProvisionPanel
              runtime={runtime}
              hasSlack={Boolean(slack)}
              onProvisioned={() => setRefreshKey((k) => k + 1)}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <RuntimeIframe
              key={refreshKey}
              url={`https://${runtime.subdomain}`}
              instanceId={runtime.instanceId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
