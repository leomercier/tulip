"use client";

import { useState } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { CommandType, RuntimeCommand } from "@tulip/types";
import {
  RotateCcw,
  RefreshCw,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

const COMMANDS: Array<{ type: CommandType; label: string; icon: React.ElementType; description: string }> = [
  {
    type: "restart_openclaw",
    label: "Restart OpenClaw",
    icon: RotateCcw,
    description: "Restart the OpenClaw Docker container",
  },
  {
    type: "restart_cloudflared",
    label: "Restart Tunnel",
    icon: RefreshCw,
    description: "Restart the Cloudflare Tunnel service",
  },
  {
    type: "rebootstrap",
    label: "Re-bootstrap",
    icon: Wrench,
    description: "Re-run the bootstrap script (rotates tokens)",
  },
];

const STATUS_STYLES: Record<RuntimeCommand["status"], string> = {
  queued: "text-gray-400",
  running: "text-blue-600",
  done: "text-green-600",
  error: "text-red-600",
};

const STATUS_ICONS: Record<RuntimeCommand["status"], React.ElementType> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle2,
  error: XCircle,
};

interface CommandPanelProps {
  instanceId: string;
  commands: RuntimeCommand[];
}

export function CommandPanel({ instanceId, commands }: CommandPanelProps) {
  const [sending, setSending] = useState<CommandType | null>(null);

  async function sendCommand(type: CommandType) {
    setSending(type);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch("/api/runtime/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Command failed");
      }

      const label = COMMANDS.find((c) => c.type === type)?.label ?? type;
      toast.success(`${label} queued — agent will execute it within 15s`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Command failed";
      toast.error(msg);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-medium text-gray-800">Commands</h3>
        </CardHeader>
        <CardContent className="space-y-2">
          {COMMANDS.map(({ type, label, icon: Icon, description }) => (
            <div
              key={type}
              className="flex items-center justify-between gap-4 py-1.5"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 truncate">{description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => sendCommand(type)}
                loading={sending === type}
                className="shrink-0"
              >
                Run
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {commands.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-gray-800">Command history</h3>
          </CardHeader>
          <CardContent className="space-y-1 py-2">
            {commands.slice(0, 10).map((cmd) => {
              const StatusIcon = STATUS_ICONS[cmd.status];
              return (
                <div key={cmd.id} className="flex items-center gap-3 py-1.5">
                  <StatusIcon
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      STATUS_STYLES[cmd.status],
                      cmd.status === "running" && "animate-spin"
                    )}
                  />
                  <span className="flex-1 text-xs font-mono text-gray-500">
                    {cmd.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(cmd.createdAt)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
