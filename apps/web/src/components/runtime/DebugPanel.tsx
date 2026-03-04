"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Copy, Check, Download, Key } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import type { Runtime } from "@tulip/types";

interface DebugPanelProps {
  runtime: Runtime;
  orgId: string;
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

export function DebugPanel({ runtime, orgId }: DebugPanelProps) {
  const [downloading, setDownloading] = useState(false);

  if (!runtime.ipv4) return null;

  async function downloadSSHKey() {
    setDownloading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/runtime/sshKey?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to download key");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tulip-${orgId.slice(0, 8)}-${runtime.instanceId}.pem`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const hasSSHKey = Boolean(runtime.sshPrivateKeyEncrypted);
  const sshCmd = `ssh -i tulip-key.pem root@${runtime.ipv4}`;

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-800">Debug</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SSH key section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-700">SSH Access</p>
            </div>
            {hasSSHKey && (
              <Button
                size="sm"
                variant="secondary"
                onClick={downloadSSHKey}
                loading={downloading}
              >
                <Download className="w-3.5 h-3.5" />
                Download key
              </Button>
            )}
          </div>
          {hasSSHKey ? (
            <CopyLine label="SSH command (after downloading key)" value={sshCmd} />
          ) : (
            <p className="text-xs text-gray-400">
              SSH key not available — reprovision the runtime to generate one.
            </p>
          )}
          {runtime.sshPublicKey && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Public key</p>
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                <code className="text-xs font-mono text-gray-500 break-all line-clamp-2">
                  {runtime.sshPublicKey}
                </code>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-3">
          <CopyLine label="Check boot status" value="cloud-init status --long" />
          <CopyLine label="Watch agent logs" value="journalctl -u tulip-agent -f" />
          <CopyLine label="Watch OpenClaw logs" value="journalctl -u openclaw -f" />
          <CopyLine label="Watch terminal logs" value="journalctl -u tulip-terminal -f" />
          <CopyLine label="Watch file browser logs" value="journalctl -u tulip-files -f" />
        </div>

        <p className="text-xs text-gray-400 pt-1">
          IP: {runtime.ipv4} &middot; instance: {runtime.instanceId}
        </p>
      </CardContent>
    </Card>
  );
}
