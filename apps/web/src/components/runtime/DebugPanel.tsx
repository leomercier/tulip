"use client";

import { useState } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Terminal, Copy, Check, RefreshCw } from "lucide-react";
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
  const [fetching, setFetching] = useState(false);
  const [fetchedIp, setFetchedIp] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const ipv4 = fetchedIp ?? runtime.ipv4;

  async function fetchIp() {
    setFetching(true);
    setFetchError(null);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch("/api/runtime/refresh-ip", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 202) {
        setFetchError("IP not assigned yet — droplet may still be starting.");
        return;
      }
      if (!res.ok) {
        setFetchError(data.error ?? "Failed to fetch IP");
        return;
      }
      setFetchedIp(data.ipv4);
    } catch {
      setFetchError("Network error");
    } finally {
      setFetching(false);
    }
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-800">Debug</h2>
          </div>
          {!ipv4 && (
            <button
              onClick={fetchIp}
              disabled={fetching}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching IP…" : "Fetch IP"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {ipv4 ? (
          <>
            <CopyLine label="SSH into droplet" value={`ssh root@${ipv4}`} />
            <CopyLine label="Check boot status" value="cloud-init status --long" />
            <CopyLine label="Watch agent logs" value="journalctl -u tulip-agent -f" />
            <CopyLine label="Watch OpenClaw logs" value="journalctl -u openclaw -f" />
            <p className="text-xs text-gray-400 pt-1">
              IP: {ipv4} &middot; instance: {runtime.instanceId}
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              IP address not available yet.{" "}
              {runtime.status === "provisioning"
                ? "The droplet is still being created."
                : "Click Fetch IP to retrieve it from DigitalOcean."}
            </p>
            {fetchError && (
              <p className="text-xs text-red-600">{fetchError}</p>
            )}
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1.5 opacity-50">
              <p className="text-xs font-mono text-gray-500">ssh root@&lt;pending&gt;</p>
              <p className="text-xs font-mono text-gray-500">cloud-init status --long</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
