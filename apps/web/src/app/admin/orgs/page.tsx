"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Loader2,
  TrendingUp,
  Users,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface OrgRow {
  id: string;
  name: string;
  ownerUid: string;
  status: string;
  memberCount: number;
  createdAt: string | null;
  billing: {
    credits: number;
    status: string;
    currencyCode: string;
  } | null;
}

function creditsToDisplay(credits: number): string {
  return `$${(credits / 100).toFixed(2)}`;
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/admin/orgs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setOrgs(data.orgs);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalCredits = orgs.reduce((s, o) => s + (o.billing?.credits ?? 0), 0);
  const totalMembers = orgs.reduce((s, o) => s + o.memberCount, 0);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Organisations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All organisations on this Tulip instance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total orgs", value: orgs.length.toString(), icon: Building2 },
          { label: "Total members", value: totalMembers.toString(), icon: Users },
          {
            label: "Total credits",
            value: creditsToDisplay(totalCredits),
            icon: CreditCard,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <Icon className="w-5 h-5 text-zinc-500 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-zinc-200">All organisations</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 py-4">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="py-2 pr-4 text-xs font-medium text-zinc-500">Organisation</th>
                    <th className="py-2 pr-4 text-xs font-medium text-zinc-500">Members</th>
                    <th className="py-2 pr-4 text-xs font-medium text-zinc-500">Credits</th>
                    <th className="py-2 pr-4 text-xs font-medium text-zinc-500">Billing</th>
                    <th className="py-2 text-xs font-medium text-zinc-500">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-zinc-200">{org.name}</p>
                        <p className="text-xs text-zinc-600 font-mono">{org.id}</p>
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">{org.memberCount}</td>
                      <td className="py-3 pr-4">
                        {org.billing ? (
                          <span className="tabular-nums text-zinc-300">
                            {org.billing.credits.toLocaleString()}
                            <span className="text-zinc-600 ml-1 text-xs">
                              ({creditsToDisplay(org.billing.credits)})
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            org.billing?.status === "active"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-yellow-900/30 text-yellow-400"
                          }`}
                        >
                          {org.billing?.status ?? "none"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            org.status === "active"
                              ? "bg-green-900/20 text-green-500"
                              : "bg-red-900/20 text-red-400"
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>
                      <td className="py-3 pl-2">
                        <Link href={`/admin/orgs/${org.id}/billing`}>
                          <Button size="sm" variant="secondary">
                            Billing
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
