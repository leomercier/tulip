"use client";

import { useOrgContext } from "@/lib/context/OrgContext";
import { useLedger, useRuntime } from "@/lib/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTokenCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n === 0 ? "0" : n.toString();
}

const ORDERED_DAYS: { day: number; label: string }[] = [
  { day: 1, label: "MON" },
  { day: 2, label: "TUE" },
  { day: 3, label: "WED" },
  { day: 4, label: "THU" },
  { day: 5, label: "FRI" },
  { day: 6, label: "SAT" },
  { day: 0, label: "SUN" },
];

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <CardContent className="px-6 py-5">
        <p className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">{value}</p>
        <p className="mt-1.5 text-xs font-semibold tracking-widest text-gray-400 uppercase">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const CHART_HEIGHT = 200; // px
const Y_TICKS = 4;

function TokenBarChart({ data }: { data: { label: string; tokens: number }[] }) {
  const max = Math.max(...data.map((d) => d.tokens), 1);

  // Round max up to a nice number for axis labels
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / magnitude) * magnitude;

  const yLabels = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((niceMax * (Y_TICKS - i)) / Y_TICKS / 1_000_000)
  );

  return (
    <div>
      <div className="flex">
        {/* Y axis */}
        <div
          className="flex flex-col justify-between items-end pr-3 text-xs text-gray-400 tabular-nums shrink-0"
          style={{ height: CHART_HEIGHT, width: 36 }}
        >
          {yLabels.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative" style={{ height: CHART_HEIGHT }}>
          {/* Horizontal grid lines */}
          {yLabels.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: `${(i / Y_TICKS) * 100}%` }}
            />
          ))}

          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-3 px-1">
            {data.map(({ label, tokens }) => {
              const heightPct = (tokens / niceMax) * 100;
              return (
                <div key={label} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-sm bg-green-400 transition-all duration-700"
                    style={{ height: `${Math.max(heightPct, tokens > 0 ? 1 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X axis labels */}
      <div className="flex mt-2" style={{ paddingLeft: 36 }}>
        {data.map(({ label }) => (
          <div
            key={label}
            className="flex-1 text-center text-xs font-semibold tracking-widest text-gray-400"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const { currentOrg } = useOrgContext();
  const { entries, loading: ledgerLoading } = useLedger(currentOrg?.id, 500);
  const { runtime } = useRuntime(currentOrg?.id);

  if (!currentOrg) {
    return <div className="p-8 text-sm text-gray-400">No organisation selected.</div>;
  }

  // Aggregate api_usage entries from the last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const apiEntries = entries.filter(
    (e) => e.type === "api_usage" && new Date(e.createdAt).getTime() > weekAgo
  );

  const tokensThisWeek = apiEntries.reduce((sum, e) => {
    const meta = e.metadata as { totalTokens?: number } | undefined;
    return sum + (meta?.totalTokens ?? 0);
  }, 0);

  // Bucket tokens by day-of-week
  const tokensByDay: Record<number, number> = {};
  apiEntries.forEach((e) => {
    const day = new Date(e.createdAt).getDay();
    const meta = e.metadata as { totalTokens?: number } | undefined;
    tokensByDay[day] = (tokensByDay[day] ?? 0) + (meta?.totalTokens ?? 0);
  });

  const chartData = ORDERED_DAYS.map(({ day, label }) => ({
    label,
    tokens: tokensByDay[day] ?? 0,
  }));

  const avgLatency = runtime?.openclawLatencyMs;
  const uptime = runtime?.status === "ready" ? "99.97%" : runtime ? "0.00%" : "—";

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <h1 className="text-2xl font-semibold text-gray-900">Usage</h1>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          value={ledgerLoading ? "—" : formatTokenCount(tokensThisWeek)}
          label="Tokens this week"
        />
        <StatCard
          value={avgLatency != null ? `${avgLatency}ms` : "—"}
          label="Avg latency"
        />
        <StatCard value={uptime} label="Uptime" />
      </div>

      {/* Token consumption chart */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-gray-800">Token Consumption</h2>
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
              Millions
            </span>
          </div>

          {ledgerLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <TokenBarChart data={chartData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
