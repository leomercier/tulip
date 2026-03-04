"use client";

import { cn, formatRelativeTime } from "@/lib/utils";
import type { Runtime } from "@tulip/types";
import { CheckCircle2, XCircle, HelpCircle, Server, Globe, Radio, Activity } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ServiceHealth = boolean | null;

function HealthDot({ ok }: { ok: ServiceHealth }) {
  if (ok === null) {
    return <HelpCircle className="w-4 h-4 text-gray-400" />;
  }
  return ok ? (
    <CheckCircle2 className="w-4 h-4 text-green-600" />
  ) : (
    <XCircle className="w-4 h-4 text-red-600" />
  );
}

function HealthRow({
  icon: Icon,
  label,
  ok,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  ok: ServiceHealth;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      {detail && <span className="text-xs text-gray-400">{detail}</span>}
      <HealthDot ok={ok} />
    </div>
  );
}

/** Returns true if the last heartbeat was within 90 seconds (3× the 30s interval) */
function isAgentAlive(lastHeartbeatAt: string | null): boolean | null {
  if (!lastHeartbeatAt) return null;
  const age = Date.now() - new Date(lastHeartbeatAt).getTime();
  return age < 90_000;
}

interface HealthStatusProps {
  runtime: Runtime;
}

export function HealthStatus({ runtime }: HealthStatusProps) {
  const agentAlive = isAgentAlive(runtime.lastHeartbeatAt);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-800">Service health</h3>
      </CardHeader>
      <CardContent className="divide-y divide-gray-200 py-0">
        {/* Agent connection row */}
        <HealthRow
          icon={Radio}
          label="Runtime agent"
          ok={agentAlive}
          detail={
            runtime.agentConnectedAt
              ? `since ${formatRelativeTime(runtime.agentConnectedAt)}`
              : agentAlive === null
              ? "waiting for agent"
              : undefined
          }
        />

        <HealthRow
          icon={Server}
          label="OpenClaw"
          ok={runtime.openclawHealthy}
          detail={runtime.openclawHealthy ? "http://localhost:3000" : undefined}
        />
        <HealthRow
          icon={Globe}
          label="Cloudflare Tunnel"
          ok={runtime.cloudflaredHealthy}
          detail={runtime.cloudflaredHealthy ? runtime.hostname : undefined}
        />

        {/* Metrics row */}
        {runtime.metrics && (
          <div className="py-2 space-y-1">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Activity className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1">System</span>
            </div>
            <div className="pl-6 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
              <span className="text-gray-400">Load</span>
              <span className="text-right font-mono">{runtime.metrics.load1.toFixed(2)}</span>
              <span className="text-gray-400">Free mem</span>
              <span className="text-right font-mono">{runtime.metrics.memFreeMb} MB</span>
              {runtime.metrics.diskFreeGb !== undefined && (
                <>
                  <span className="text-gray-400">Free disk</span>
                  <span className="text-right font-mono">{runtime.metrics.diskFreeGb} GB</span>
                </>
              )}
            </div>
          </div>
        )}

        {runtime.lastHeartbeatAt && (
          <div className="flex items-center gap-3 py-2 text-xs text-gray-400">
            <span className="flex-1">Last heartbeat</span>
            <span>{formatRelativeTime(runtime.lastHeartbeatAt)}</span>
          </div>
        )}
        {runtime.lastError && (
          <div className="py-2">
            <p className="text-xs text-red-600 font-mono break-all">{runtime.lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
