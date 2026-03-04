"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Terminal, Copy, Check } from "lucide-react";
import type { Runtime } from "@tulip/types";

interface DebugPanelProps {
  runtime: Runtime;
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
        <code className="flex-1 text-xs font-mono text-gray-700 break-all">{value}</code>
        <button
          onClick={copy}
          title="Copy"
          className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export function DebugPanel({ runtime }: DebugPanelProps) {
  if (!runtime.ipv4) return null;

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-800">Debug</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CopyLine label="SSH into droplet" value={`ssh root@${runtime.ipv4}`} />
        <CopyLine label="Check boot status" value="cloud-init status --long" />
        <CopyLine label="Watch agent logs" value="journalctl -u tulip-agent -f" />
        <CopyLine label="Watch OpenClaw logs" value="journalctl -u openclaw -f" />
        <p className="text-xs text-gray-400 pt-1">
          IP: {runtime.ipv4} &middot; instance: {runtime.instanceId}
        </p>
      </CardContent>
    </Card>
  );
}
