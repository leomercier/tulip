"use client";

import { cn, formatRelativeTime } from "@/lib/utils";
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

interface HealthStatusProps {
  runtime: Runtime;
}

export function HealthStatus({ runtime }: HealthStatusProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-800">Service health</h3>
      </CardHeader>
      <CardContent className="divide-y divide-gray-200 py-0">
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
        {runtime.lastHeartbeatAt && (
          <div className="flex items-center gap-3 py-2 text-xs text-gray-400">
            <span className="flex-1">Last check</span>
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
