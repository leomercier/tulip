"use client";

import { formatRelativeTime } from "@/lib/utils";
import type { Runtime } from "@tulip/types";
import { CheckCircle2, XCircle, HelpCircle, Server, Globe } from "lucide-react";
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

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-mono text-gray-700">{value}</span>
    </div>
  );
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

interface HealthStatusProps {
  runtime: Runtime;
}

export function HealthStatus({ runtime }: HealthStatusProps) {
  const { metrics, openclawLatencyMs, agentVersion, openclawImage } = runtime;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-800">Service health</h3>
      </CardHeader>
      <CardContent className="divide-y divide-gray-100 py-0">
        {/* ── Service checks ── */}
        <HealthRow
          icon={Server}
          label="OpenClaw"
          ok={runtime.openclawHealthy}
          detail={
            runtime.openclawHealthy && openclawLatencyMs !== null
              ? `${openclawLatencyMs}ms`
              : undefined
          }
        />
        <HealthRow
          icon={Globe}
          label="Cloudflare Tunnel"
          ok={runtime.cloudflaredHealthy}
          detail={runtime.cloudflaredHealthy ? runtime.hostname : undefined}
        />

        {/* ── Last heartbeat ── */}
        {runtime.lastHeartbeatAt && (
          <div className="flex items-center gap-3 py-2 text-xs text-gray-400">
            <span className="flex-1">Last check</span>
            <span>{formatRelativeTime(runtime.lastHeartbeatAt)}</span>
          </div>
        )}

        {/* ── System metrics ── */}
        {metrics && (
          <div className="py-2.5 space-y-1.5">
            <p className="text-xs font-medium text-gray-400 mb-2">System</p>
            <MetricItem label="Uptime" value={formatUptime(metrics.uptimeSec)} />
            <MetricItem label="Load (1m)" value={metrics.load1.toFixed(2)} />
            <MetricItem label="Memory free" value={`${metrics.memFreeMb} MB`} />
            {metrics.diskFreeGb > 0 && (
              <MetricItem label="Disk free" value={`${metrics.diskFreeGb} GB`} />
            )}
          </div>
        )}

        {/* ── Agent info ── */}
        {(agentVersion || openclawImage) && (
          <div className="py-2.5 space-y-1.5">
            <p className="text-xs font-medium text-gray-400 mb-2">Agent</p>
            {agentVersion && (
              <MetricItem label="Version" value={agentVersion} />
            )}
            {openclawImage && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-500 shrink-0">Image</span>
                <span
                  className="text-xs font-mono text-gray-700 text-right break-all"
                  title={openclawImage}
                >
                  {openclawImage.includes("/")
                    ? openclawImage.replace(/^[^/]+\/[^/]+\//, "…/")
                    : openclawImage}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Last error ── */}
        {runtime.lastError && (
          <div className="py-2">
            <p className="text-xs text-red-600 font-mono break-all">{runtime.lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
