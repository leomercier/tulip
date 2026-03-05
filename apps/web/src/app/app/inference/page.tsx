"use client";

import { useOrgContext } from "@/lib/context/OrgContext";
import { useLedger } from "@/lib/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODEL_NAMES: Record<string, string> = {
  "accounts/fireworks/models/kimi-k2.5": "KIMI-K2.5",
  "accounts/fireworks/models/kimi-k2p5": "KIMI-K2.5",
  "accounts/fireworks/models/llama-v3p1-405b-instruct": "LLAMA-3.1-405B",
  "accounts/fireworks/models/llama-v3p1-70b-instruct": "LLAMA-3.1-70B",
};

const PROVIDER_NAMES: Record<string, string> = {
  "accounts/fireworks/models/kimi-k2.5": "Fireworks AI",
  "accounts/fireworks/models/kimi-k2p5": "Fireworks AI",
  "accounts/fireworks/models/llama-v3p1-405b-instruct": "Fireworks AI",
  "accounts/fireworks/models/llama-v3p1-70b-instruct": "Fireworks AI",
};

function modelDisplayName(id: string): string {
  return MODEL_NAMES[id] ?? id.split("/").pop()?.toUpperCase() ?? id;
}

function providerDisplayName(id: string): string {
  return PROVIDER_NAMES[id] ?? (id.includes("fireworks") ? "Fireworks AI" : "Unknown");
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Model row ────────────────────────────────────────────────────────────────

function ModelRow({
  modelId,
  tokens,
  requests,
  pct,
}: {
  modelId: string;
  tokens: number;
  requests: number;
  pct: number;
}) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold font-mono text-gray-900 tracking-tight">
              {modelDisplayName(modelId)}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 font-medium">
              {providerDisplayName(modelId)}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-green-400 h-2 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs text-gray-400 mt-2 tabular-nums">
          {formatTokenCount(tokens)} tokens · {requests.toLocaleString()} requests
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Empty state — shows the configured default model at 0% ──────────────────

function EmptyModelRow() {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold font-mono text-gray-900 tracking-tight">
              KIMI-K2.5
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 font-medium">
              Fireworks AI
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-400 tabular-nums">0%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-green-400 h-2 rounded-full" style={{ width: "0%" }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">No inference activity in the last 7 days.</p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InferencePage() {
  const { currentOrg } = useOrgContext();
  const { entries, loading } = useLedger(currentOrg?.id, 500);

  if (!currentOrg) {
    return <div className="p-8 text-sm text-gray-400">No organisation selected.</div>;
  }

  // Aggregate api_usage entries from the last 7 days, grouped by model
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const modelStats = new Map<string, { tokens: number; requests: number }>();

  entries
    .filter((e) => e.type === "api_usage" && new Date(e.createdAt).getTime() > weekAgo)
    .forEach((e) => {
      const meta = e.metadata as { model?: string; totalTokens?: number } | undefined;
      const model = meta?.model ?? "unknown";
      const tokens = meta?.totalTokens ?? 0;
      const prev = modelStats.get(model) ?? { tokens: 0, requests: 0 };
      modelStats.set(model, { tokens: prev.tokens + tokens, requests: prev.requests + 1 });
    });

  const totalTokens = Array.from(modelStats.values()).reduce((s, v) => s + v.tokens, 0) || 1;
  const models = Array.from(modelStats.entries()).sort((a, b) => b[1].tokens - a[1].tokens);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-gray-900">Inference</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : models.length === 0 ? (
        <EmptyModelRow />
      ) : (
        models.map(([modelId, { tokens, requests }]) => (
          <ModelRow
            key={modelId}
            modelId={modelId}
            tokens={tokens}
            requests={requests}
            pct={Math.round((tokens / totalTokens) * 100)}
          />
        ))
      )}
    </div>
  );
}
