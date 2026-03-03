"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useOrgContext } from "@/lib/context/OrgContext";
import { useSlackIntegration } from "@/lib/hooks/useOrg";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Loader2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { formatRelativeTime } from "@/lib/utils";

function IntegrationsContent() {
  const { user } = useAuth();
  const { currentOrg: org, loading: orgLoading } = useOrgContext();
  const { slack, loading: slackLoading } = useSlackIntegration(org?.id);
  const searchParams = useSearchParams();
  const [connectingSlack, setConnectingSlack] = useState(false);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "slack_connected") {
      toast.success("Slack connected successfully!");
      window.history.replaceState({}, "", "/app/integrations");
    }
    if (error) {
      const messages: Record<string, string> = {
        slack_denied: "Slack access was denied.",
        slack_oauth_failed: "Slack OAuth failed. Please try again.",
        invalid_callback: "Invalid OAuth callback.",
        invalid_state: "OAuth state mismatch. Please try again.",
      };
      toast.error(messages[error] ?? "An error occurred.");
      window.history.replaceState({}, "", "/app/integrations");
    }
  }, [searchParams]);

  async function ensureOrgExists(): Promise<string> {
    if (org) return org.id;

    // Create org via API (also sets up member record + billing account)
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken || !user) throw new Error("Not authenticated");

    const res = await fetch("/api/orgs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ name: user.displayName ?? user.email ?? "My Org" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create org");
    return data.orgId;
  }

  async function handleConnectSlack() {
    setConnectingSlack(true);
    try {
      const orgId = await ensureOrgExists();
      window.location.href = `/api/slack/install?orgId=${orgId}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start Slack connect";
      toast.error(msg);
      setConnectingSlack(false);
    }
  }

  if (orgLoading || slackLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <Toaster position="top-right" toastOptions={{ className: "!bg-zinc-800 !text-zinc-100 !border !border-zinc-700" }} />

      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect your messaging platforms to Tulip.
        </p>
      </div>

      {/* Slack */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#4A154B]/30 border border-[#4A154B]/50 flex items-center justify-center">
                <SlackLogo />
              </div>
              <div>
                <h2 className="text-sm font-medium text-zinc-200">Slack</h2>
                <p className="text-xs text-zinc-500">
                  Receive and respond to messages in your workspace
                </p>
              </div>
            </div>
            {slack ? (
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {slack ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Workspace</span>
                <span className="text-zinc-200 font-medium">{slack.teamName || slack.teamId}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Team ID</span>
                <code className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                  {slack.teamId}
                </code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Installed</span>
                <span className="text-zinc-400">{formatRelativeTime(slack.installedAt)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Connect your Slack workspace to allow the agent to send and
                receive messages. The agent will be available as a Slack app in
                your workspace.
              </p>
              <ul className="space-y-1.5 text-sm text-zinc-500">
                {[
                  "Respond to messages in channels and DMs",
                  "Handle slash commands",
                  "Send proactive notifications",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {slack ? (
            <div className="flex items-center gap-3">
              <a
                href={`https://app.slack.com/client/${slack.teamId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="secondary">
                  Open Slack
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
              <p className="text-xs text-zinc-600">
                To disconnect, uninstall the Tulip app from your Slack workspace.
              </p>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleConnectSlack}
              loading={connectingSlack}
            >
              <SlackLogo className="w-4 h-4" />
              Connect Slack
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* WhatsApp — v1 stub */}
      <Card className="opacity-60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-zinc-200">WhatsApp</h2>
                <p className="text-xs text-zinc-500">
                  Connect via WhatsApp Business API
                </p>
              </div>
            </div>
            <Badge variant="outline">Coming soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            WhatsApp integration will be available in a future release. Stay
            tuned.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm" disabled>
            <MessageCircle className="w-4 h-4" />
            Connect WhatsApp
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function SlackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 124 124"
      className={className ?? "w-5 h-5"}
      aria-hidden
    >
      <path
        d="M26.3 78.4c0 7.2-5.8 13-13 13s-13-5.8-13-13 5.8-13 13-13h13v13z"
        fill="#E01E5A"
      />
      <path
        d="M32.8 78.4c0-7.2 5.8-13 13-13s13 5.8 13 13v32.5c0 7.2-5.8 13-13 13s-13-5.8-13-13V78.4z"
        fill="#E01E5A"
      />
      <path
        d="M45.8 26.3c-7.2 0-13-5.8-13-13s5.8-13 13-13 13 5.8 13 13v13h-13z"
        fill="#36C5F0"
      />
      <path
        d="M45.8 32.8c7.2 0 13 5.8 13 13s-5.8 13-13 13H13.3c-7.2 0-13-5.8-13-13s5.8-13 13-13h32.5z"
        fill="#36C5F0"
      />
      <path
        d="M97.7 45.8c0-7.2 5.8-13 13-13s13 5.8 13 13-5.8 13-13 13h-13v-13z"
        fill="#2EB67D"
      />
      <path
        d="M91.2 45.8c0 7.2-5.8 13-13 13s-13-5.8-13-13V13.3c0-7.2 5.8-13 13-13s13 5.8 13 13v32.5z"
        fill="#2EB67D"
      />
      <path
        d="M78.2 97.7c7.2 0 13 5.8 13 13s-5.8 13-13 13-13-5.8-13-13v-13h13z"
        fill="#ECB22E"
      />
      <path
        d="M78.2 91.2c-7.2 0-13-5.8-13-13s5.8-13 13-13h32.5c7.2 0 13 5.8 13 13s-5.8 13-13 13H78.2z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
