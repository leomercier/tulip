"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useOrgContext } from "@/lib/context/OrgContext";
import { useBillingAccount, useLedger } from "@/lib/hooks/useOrg";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditCard, TrendingDown, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { LedgerEntry } from "@tulip/types";

function creditsToDisplay(credits: number): string {
  const dollars = credits / 100;
  return `$${dollars.toFixed(2)}`;
}

function EntryTypeLabel({ type }: { type: LedgerEntry["type"] }) {
  const map: Record<LedgerEntry["type"], { label: string; color: string }> = {
    credit_grant: { label: "Credit grant", color: "text-green-400" },
    credit_purchase: { label: "Purchase", color: "text-green-400" },
    runtime_usage: { label: "Runtime usage", color: "text-zinc-400" },
    api_usage: { label: "API usage", color: "text-zinc-400" },
    adjustment: { label: "Adjustment", color: "text-yellow-400" },
  };
  const { label, color } = map[type] ?? { label: type, color: "text-zinc-400" };
  return <span className={`text-xs ${color}`}>{label}</span>;
}

export default function BillingPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrgContext();
  const { billing, loading: billingLoading } = useBillingAccount(currentOrg?.id);
  const { entries, loading: ledgerLoading } = useLedger(currentOrg?.id, 50);

  if (!currentOrg) {
    return <div className="p-8 text-zinc-500 text-sm">No organisation selected.</div>;
  }

  const isLow = billing ? billing.credits < 500 : false;
  const isEmpty = billing ? billing.credits <= 0 : true;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Credits are consumed by runtime and AI usage. 1 credit = $0.01 USD.
        </p>
      </div>

      {/* Balance card */}
      <Card className={isEmpty ? "border-red-800/50" : isLow ? "border-yellow-800/50" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Credit balance</h2>
          </div>
        </CardHeader>
        <CardContent>
          {billingLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold tabular-nums text-zinc-100">
                  {billing ? billing.credits.toLocaleString() : "0"}
                </p>
                <p className="text-sm text-zinc-500 mb-1">
                  credits · {billing ? creditsToDisplay(billing.credits) : "$0.00"} USD
                </p>
              </div>

              {isEmpty && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Your balance is empty. Contact your administrator to add credits.
                </div>
              )}
              {!isEmpty && isLow && (
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Low balance — less than $5 remaining.
                </div>
              )}

              <p className="text-xs text-zinc-600">
                Status:{" "}
                <span className={billing?.status === "active" ? "text-green-400" : "text-yellow-400"}>
                  {billing?.status ?? "unknown"}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-zinc-200">Transaction history</h2>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-600 py-4 text-center">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-4 py-3">
                  <div className="shrink-0">
                    {entry.amount >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <EntryTypeLabel type={entry.type} />
                      <span className="text-xs text-zinc-600">·</span>
                      <span className="text-xs text-zinc-600">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-mono font-medium tabular-nums ${
                        entry.amount >= 0 ? "text-green-400" : "text-zinc-400"
                      }`}
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-600 tabular-nums">
                      bal. {entry.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
