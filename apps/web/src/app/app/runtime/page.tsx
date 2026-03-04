"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserOrg, useRuntime, useSlackIntegration, useCommandHistory } from "@/lib/hooks/useOrg";
import { RuntimeIframe } from "@/components/runtime/RuntimeIframe";
import { ProvisionPanel } from "@/components/runtime/ProvisionPanel";
import { HealthStatus } from "@/components/runtime/HealthStatus";
import { CommandPanel } from "@/components/runtime/CommandPanel";
import { DebugPanel } from "@/components/runtime/DebugPanel";
import { StatusBadge } from "@/components/ui/badge";
import { Loader2, LayoutGrid, SplitSquareVertical, Terminal, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

type ViewMode = "split" | "full" | "terminal" | "files";

const VIEW_MODES: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "split", icon: SplitSquareVertical, label: "Split" },
  { mode: "full", icon: LayoutGrid, label: "Agent" },
  { mode: "terminal", icon: Terminal, label: "Terminal" },
  { mode: "files", icon: FolderOpen, label: "Files" },
];

export default function RuntimePage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useUserOrg(user?.uid);
  const { runtime, loading: runtimeLoading } = useRuntime(org?.id);
  const { slack } = useSlackIntegration(org?.id);
  const { commands } = useCommandHistory(runtime?.instanceId);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [refreshKey, setRefreshKey] = useState(0);

  const isReady = runtime?.status === "ready";

  if (orgLoading || runtimeLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{ className: "!bg-white !text-gray-900 !border !border-gray-200 !shadow-md" }}
      />

      {/* Page header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white/80 backdrop-blur shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium text-gray-800 shrink-0">Runtime</h1>
          {runtime && <StatusBadge status={runtime.status} />}
          {runtime && (
            <code className="text-xs text-gray-400 font-mono hidden sm:block truncate">
              {runtime.instanceId}
            </code>
          )}
        </div>

        {isReady && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200 shrink-0">
            {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
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
        <div className="flex-1 overflow-y-auto">
          <ProvisionPanel
            runtime={runtime}
            hasSlack={Boolean(slack)}
            onProvisioned={() => setRefreshKey((k) => k + 1)}
          />
          {runtime && (
            <div className="px-4 pb-4 sm:px-8 sm:pb-8 max-w-2xl mx-auto">
              <DebugPanel runtime={runtime} orgId={org?.id ?? ""} />
            </div>
          )}
        </div>
      ) : viewMode === "full" ? (
        <div className="flex-1 overflow-hidden">
          <RuntimeIframe
            key={refreshKey}
            url={`https://${runtime.subdomain}`}
            instanceId={runtime.instanceId}
          />
        </div>
      ) : viewMode === "terminal" ? (
        <div className="flex-1 overflow-hidden">
          <RuntimeIframe
            key={`terminal-${refreshKey}`}
            url={`https://${runtime.subdomain}/terminal`}
            instanceId={runtime.instanceId}
            title="Web Terminal"
          />
        </div>
      ) : viewMode === "files" ? (
        <div className="flex-1 overflow-hidden">
          <RuntimeIframe
            key={`files-${refreshKey}`}
            url={`https://${runtime.subdomain}/files`}
            instanceId={runtime.instanceId}
            title="File Browser"
          />
        </div>
      ) : (
        // Split: sidebar left with health + commands, iframe right (stacked on mobile)
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="w-full md:w-72 md:shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 scrollbar-none h-48 md:h-auto">
            <div className="p-4 space-y-4">
              <HealthStatus runtime={runtime} />
              <CommandPanel
                instanceId={runtime.instanceId}
                commands={commands}
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
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
