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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {org ? `${org.name}` : "Welcome to Tulip"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
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
                <Plug className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-800">Slack</span>
              </div>
              {slack ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="text-xs text-gray-400">Not connected</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {slack ? (
              <p className="text-sm text-gray-600">
                Team connected ·{" "}
                <span className="text-gray-500">
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
                <Cpu className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-800">Runtime</span>
              </div>
              <StatusBadge status={runtime?.status ?? "not_provisioned"} />
            </div>
          </CardHeader>
          <CardContent>
            {runtime ? (
              <div className="space-y-1">
                <p className="text-xs font-mono text-gray-500">
                  {runtime.instanceId}
                </p>
                {runtime.lastHeartbeatAt && (
                  <p className="text-xs text-gray-400">
                    Last seen {formatRelativeTime(runtime.lastHeartbeatAt)}
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
            <h2 className="text-sm font-medium text-gray-800">Getting started</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, i) => (
              <Link key={step.id} href={step.href}>
                <div className="flex items-start gap-4 group py-1">
                  <div className="mt-0.5">
                    {step.done ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        step.done
                          ? "text-gray-400 line-through"
                          : "text-gray-800 group-hover:text-gray-900 transition-colors"
                      }`}
                    >
                      {i + 1}. {step.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {!step.done && (
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5 shrink-0" />
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All done state */}
      {allDone && runtime?.status === "ready" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 py-5">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                Your runtime is live
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Agent accessible at{" "}
                <a
                  href={`https://${runtime.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-gray-900 hover:underline"
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
