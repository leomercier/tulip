"use client";

import { useState } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import {
  Cpu,
  Server,
  Globe,
  Zap,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { Runtime } from "@tulip/types";
import toast from "react-hot-toast";

interface ProvisionPanelProps {
  runtime: Runtime | null;
  hasSlack: boolean;
  onProvisioned: () => void;
}

export function ProvisionPanel({ runtime, hasSlack, onProvisioned }: ProvisionPanelProps) {
  const [provisioning, setProvisioning] = useState(false);
  const [deprovisioning, setDeprovisioning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleProvision() {
    if (!hasSlack) {
      toast.error("Connect Slack before provisioning a runtime.");
      return;
    }
    setProvisioning(true);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch("/api/runtime/provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Provision failed");
      }
      toast.success("Runtime provisioning started. This takes ~2 minutes.");
      onProvisioned();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Provision failed";
      toast.error(msg);
    } finally {
      setProvisioning(false);
    }
  }

  async function handleDeprovision() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeprovisioning(true);
    setConfirmDelete(false);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch("/api/runtime/deprovision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Deprovision failed");
      }
      toast.success("Runtime deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deprovision failed";
      toast.error(msg);
    } finally {
      setDeprovisioning(false);
    }
  }

  const isTransitioning =
    runtime?.status === "provisioning" ||
    runtime?.status === "booting" ||
    runtime?.status === "deleting";

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Not provisioned */}
      {!runtime && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-zinc-200">
                  No runtime provisioned
                </h2>
                <p className="text-xs text-zinc-500">
                  Provision an isolated OpenClaw instance to get started.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasSlack && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-3">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  You must connect Slack before provisioning a runtime.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  icon: Server,
                  title: "Isolated compute",
                  desc: "Dedicated Ubuntu 22.04 droplet on DigitalOcean",
                },
                {
                  icon: Globe,
                  title: "Secure tunnel",
                  desc: "Exposed via Cloudflare Tunnel — no public ports",
                },
                {
                  icon: Zap,
                  title: "Auto-configured",
                  desc: "OpenClaw starts with your Slack and inference config",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 text-sm">
                  <Icon className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-zinc-300">{title}</span>
                    <span className="text-zinc-500"> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleProvision}
              loading={provisioning}
              disabled={!hasSlack}
            >
              <Cpu className="w-4 h-4" />
              Provision runtime
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Provisioning / Booting state */}
      {runtime && isTransitioning && (
        <Card className="border-blue-800/40 bg-blue-950/10">
          <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-200">
                {runtime.status === "provisioning" && "Creating droplet…"}
                {runtime.status === "booting" && "Runtime is booting…"}
                {runtime.status === "deleting" && "Deleting runtime…"}
              </p>
              <p className="text-xs text-zinc-500">
                This usually takes 1–3 minutes. The page will update automatically.
              </p>
            </div>
            <code className="text-xs font-mono text-zinc-600">
              {runtime.instanceId}
            </code>
          </CardContent>
          {runtime.status !== "deleting" && (
            <CardFooter className="justify-center gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeprovision}
                loading={deprovisioning}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? "Confirm — delete anyway" : "Force delete"}
              </Button>
              {confirmDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      )}

      {/* Error state */}
      {runtime?.status === "error" && (
        <Card className="border-red-800/40">
          <CardContent className="py-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-zinc-200">
                Runtime provisioning failed
              </p>
              <p className="text-xs text-zinc-500">
                The droplet encountered an error. You can retry provisioning.
              </p>
            </div>
          </CardContent>
          <CardFooter className="gap-3">
            <Button onClick={handleProvision} loading={provisioning}>
              <Cpu className="w-4 h-4" />
              Retry provisioning
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeprovision}
              loading={deprovisioning}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Runtime info card (always shown when runtime exists and not in error) */}
      {runtime && runtime.status !== "error" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-200">
                Runtime details
              </h2>
              <StatusBadge status={runtime.status} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                { label: "Instance ID", value: runtime.instanceId, mono: true },
                { label: "Region", value: runtime.region },
                {
                  label: "URL",
                  value: `https://${runtime.subdomain}`,
                  mono: true,
                  link: true,
                },
                {
                  label: "Created",
                  value: formatRelativeTime(runtime.createdAt),
                },
                {
                  label: "Last heartbeat",
                  value: runtime.lastHeartbeatAt
                    ? formatRelativeTime(runtime.lastHeartbeatAt)
                    : "—",
                },
              ].map(({ label, value, mono, link }) => (
                <div key={label} className="flex items-center gap-4">
                  <dt className="w-32 text-zinc-500 shrink-0">{label}</dt>
                  <dd className="text-zinc-200 min-w-0">
                    {link ? (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline text-tulip-400 ${mono ? "font-mono text-xs" : ""}`}
                      >
                        {value}
                      </a>
                    ) : (
                      <span className={mono ? "font-mono text-xs text-zinc-300" : ""}>
                        {value}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
          {runtime.status !== "deleting" && (
            <CardFooter>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeprovision}
                loading={deprovisioning}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? "Confirm — this will delete the droplet" : "Delete runtime"}
              </Button>
              {confirmDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="ml-2"
                >
                  Cancel
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
