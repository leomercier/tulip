"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useUserOrg, useRuntime, useSlackIntegration } from "@/lib/hooks/useOrg";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { Plug, Cpu, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

export default function AppOverviewPage() {
  const { user } = useAuth();
  const { org } = useUserOrg(user?.uid);
  const { runtime } = useRuntime(org?.id);
  const { slack } = useSlackIntegration(org?.id);

  const steps = [
    {
      id: "slack",
      label: "Connect Slack",
      description: "Allow Tulip to send and receive messages in your workspace.",
      done: Boolean(slack),
      href: "/app/integrations",
    },
    {
      id: "runtime",
      label: "Provision runtime",
      description: "Spin up an isolated OpenClaw instance on DigitalOcean.",
      done: runtime?.status === "ready",
      href: "/app/runtime",
    },
  ];

  const allDone = steps.every((s) => s.done);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          {org ? `${org.name}` : "Welcome to Tulip"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your isolated agent runtime from here.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Slack */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">Slack</span>
              </div>
              {slack ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="text-xs text-zinc-600">Not connected</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {slack ? (
              <p className="text-sm text-zinc-400">
                Team connected ·{" "}
                <span className="text-zinc-500">
                  {formatRelativeTime(slack.installedAt)}
                </span>
              </p>
            ) : (
              <Link href="/app/integrations">
                <Button size="sm" variant="secondary" className="mt-1">
                  Connect Slack
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Runtime */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">Runtime</span>
              </div>
              <StatusBadge status={runtime?.status ?? "not_provisioned"} />
            </div>
          </CardHeader>
          <CardContent>
            {runtime ? (
              <div className="space-y-1">
                <p className="text-xs font-mono text-zinc-500">
                  {runtime.instanceId}
                </p>
                {runtime.lastHeartbeat && (
                  <p className="text-xs text-zinc-600">
                    Last seen {formatRelativeTime(runtime.lastHeartbeat)}
                  </p>
                )}
              </div>
            ) : (
              <Link href="/app/runtime">
                <Button size="sm" variant="secondary" className="mt-1">
                  Provision runtime
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting started checklist */}
      {!allDone && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-zinc-200">Getting started</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, i) => (
              <Link key={step.id} href={step.href}>
                <div className="flex items-start gap-4 group py-1">
                  <div className="mt-0.5">
                    {step.done ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        step.done
                          ? "text-zinc-500 line-through"
                          : "text-zinc-200 group-hover:text-tulip-300 transition-colors"
                      }`}
                    >
                      {i + 1}. {step.label}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {!step.done && (
                    <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors mt-0.5 shrink-0" />
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All done state */}
      {allDone && runtime?.status === "ready" && (
        <Card className="border-green-800/50 bg-green-950/20">
          <CardContent className="flex items-center gap-4 py-5">
            <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Your runtime is live
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Agent accessible at{" "}
                <a
                  href={`https://${runtime.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-tulip-400 hover:underline"
                >
                  {runtime.subdomain}
                </a>
              </p>
            </div>
            <Link href="/app/runtime" className="ml-auto">
              <Button size="sm" variant="secondary">
                Open runtime
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
