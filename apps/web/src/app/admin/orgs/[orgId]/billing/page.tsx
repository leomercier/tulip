"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronLeft,
  Plus,
  Minus,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string | null;
  createdByUid: string | null;
}

interface BillingData {
  org: { id: string; name: string };
  billing: {
    credits: number;
    status: string;
    currencyCode: string;
  } | null;
  entries: LedgerRow[];
}

const TYPE_LABELS: Record<string, string> = {
  credit_grant: "Credit grant",
  credit_purchase: "Purchase",
  runtime_usage: "Runtime usage",
  api_usage: "API usage",
  adjustment: "Adjustment",
};

export default function AdminOrgBillingPage() {
  const params = useParams<{ orgId: string }>();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credit grant form state
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [granting, setGranting] = useState(false);

  async function load() {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/orgs/${params.orgId}/billing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.orgId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function grantCredits(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount === 0) {
      toast.error("Enter a non-zero integer credit amount");
      return;
    }
    setGranting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/orgs/${params.orgId}/billing/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, description: creditDesc.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Balance updated → ${json.newBalance.toLocaleString()} credits`);
      setCreditAmount("");
      setCreditDesc("");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setGranting(false);
    }
  }

  const credits = data?.billing?.credits ?? 0;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <Toaster
        position="top-right"
        toastOptions={{ className: "!bg-zinc-800 !text-zinc-100 !border !border-zinc-700" }}
      />

      <div className="flex items-center gap-4">
        <Link href="/admin/orgs">
          <Button size="sm" variant="secondary">
            <ChevronLeft className="w-3.5 h-3.5" />
            All orgs
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            {loading ? "…" : data?.org.name ?? "Org"} — Billing
          </h1>
          <p className="text-sm text-zinc-500 font-mono">{params.orgId}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          {/* Balance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-medium text-zinc-200">Current balance</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold tabular-nums text-zinc-100">
                  {credits.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-500 mb-1">
                  credits · ${(credits / 100).toFixed(2)} USD
                </p>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                Status:{" "}
                <span
                  className={
                    data?.billing?.status === "active" ? "text-green-400" : "text-yellow-400"
                  }
                >
                  {data?.billing?.status ?? "no billing account"}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Adjust credits */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-zinc-200">Adjust credits</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Positive value adds credits. Negative value deducts. 1 credit = $0.01 USD.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={grantCredits} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full sm:w-32 text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  />
                  <input
                    type="text"
                    value={creditDesc}
                    onChange={(e) => setCreditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const n = Math.abs(parseInt(creditAmount || "0", 10));
                      setCreditAmount(n.toString());
                    }}
                    className="text-green-400 border-green-800/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const n = Math.abs(parseInt(creditAmount || "0", 10));
                      setCreditAmount((-n).toString());
                    }}
                    className="text-red-400 border-red-800/50"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    Deduct
                  </Button>
                  <Button type="submit" size="sm" loading={granting}>
                    Apply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-zinc-200">
                Transaction history{" "}
                <span className="text-zinc-500">({data?.entries.length ?? 0})</span>
              </h2>
            </CardHeader>
            <CardContent>
              {data?.entries.length === 0 ? (
                <p className="text-sm text-zinc-600 py-4 text-center">No transactions.</p>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {data?.entries.map((entry) => (
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
                          <span className="text-xs text-zinc-500">
                            {TYPE_LABELS[entry.type] ?? entry.type}
                          </span>
                          {entry.createdAt && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className="text-xs text-zinc-600">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                            </>
                          )}
                          {entry.createdByUid && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className="text-xs text-zinc-600 font-mono truncate max-w-[120px]">
                                {entry.createdByUid}
                              </span>
                            </>
                          )}
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
        </>
      )}
    </div>
  );
}
