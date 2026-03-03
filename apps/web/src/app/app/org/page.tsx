"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useOrgContext } from "@/lib/context/OrgContext";
import { useOrgMembers, useOrgInvites } from "@/lib/hooks/useOrg";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Link2,
  Mail,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  Loader2,
  Shield,
  Crown,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatRelativeTime } from "@/lib/utils";
import type { OrgRole } from "@tulip/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getIdToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

function RoleBadge({ role }: { role: OrgRole }) {
  if (role === "owner")
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-tulip-600/20 text-tulip-300 ring-1 ring-tulip-500/30">
        <Crown className="w-3 h-3" /> Owner
      </span>
    );
  if (role === "admin")
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30">
        <Shield className="w-3 h-3" /> Admin
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
      Member
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const { user } = useAuth();
  const { currentOrg, profile } = useOrgContext();
  const { members, loading: membersLoading } = useOrgMembers(currentOrg?.id);
  const { invites, loading: invitesLoading } = useOrgInvites(currentOrg?.id);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const myRole = members.find((m) => m.uid === user?.uid)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";

  async function createLinkInvite() {
    if (!currentOrg) return;
    setInviting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId: currentOrg.id, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await navigator.clipboard.writeText(data.inviteUrl);
      toast.success("Invite link copied to clipboard!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite link");
    } finally {
      setInviting(false);
    }
  }

  async function createEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId: currentOrg.id, role: inviteRole, email: inviteEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function copyInviteLink(inviteId: string) {
    const base = window.location.origin;
    await navigator.clipboard.writeText(`${base}/invite/${inviteId}`);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function cancelInvite(inviteId: string) {
    if (!currentOrg) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/orgs/invite/${inviteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Invite cancelled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel invite");
    }
  }

  async function changeRole(targetUid: string, role: OrgRole) {
    if (!currentOrg) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/orgs/members/${targetUid}?orgId=${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Role updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function removeMember(targetUid: string) {
    if (!currentOrg) return;
    const isSelf = targetUid === user?.uid;
    if (!confirm(isSelf ? "Leave this organisation?" : "Remove this member?")) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/orgs/members/${targetUid}?orgId=${currentOrg.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success(isSelf ? "You left the organisation" : "Member removed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!currentOrg) {
    return (
      <div className="p-8 text-zinc-500 text-sm">No organisation selected.</div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">{currentOrg.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage members and invitations.</p>
      </div>

      {/* Members list */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">
              Members{" "}
              <span className="text-zinc-500">({members.length})</span>
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {members.map((member) => (
                <li key={member.uid} className="flex items-center gap-4 py-3">
                  {member.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photoURL}
                      alt={member.displayName ?? member.email}
                      className="w-8 h-8 rounded-full ring-1 ring-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-tulip-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                      {(member.displayName ?? member.email ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {member.displayName ?? member.email}
                      {member.uid === user?.uid && (
                        <span className="ml-1.5 text-xs text-zinc-600">(you)</span>
                      )}
                    </p>
                    {member.displayName && (
                      <p className="text-xs text-zinc-500 truncate">{member.email}</p>
                    )}
                  </div>
                  <RoleBadge role={member.role} />
                  {canManage && member.role !== "owner" && member.uid !== user?.uid && (
                    <div className="flex items-center gap-1">
                      <select
                        value={member.role}
                        onChange={(e) => changeRole(member.uid, e.target.value as OrgRole)}
                        className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => removeMember(member.uid)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {member.uid === user?.uid && member.role !== "owner" && (
                    <button
                      onClick={() => removeMember(member.uid)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      Leave
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invite section — admins and owners only */}
      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-medium text-zinc-200">Invite people</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role picker */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Invite as</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Copy link */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Share a link
              </p>
              <p className="text-xs text-zinc-600">
                Anyone with this link can join your organisation (expires in 7 days).
              </p>
              <Button size="sm" variant="secondary" onClick={createLinkInvite} loading={inviting}>
                <Copy className="w-3.5 h-3.5" />
                Copy invite link
              </Button>
            </div>

            {/* Email invite */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Invite by email
              </p>
              <p className="text-xs text-zinc-600">
                They will be added automatically when they sign in with that address.
              </p>
              <form onSubmit={createEmailInvite} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="flex-1 text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-tulip-500"
                />
                <Button size="sm" type="submit" loading={inviting} disabled={!inviteEmail.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-zinc-200">
              Pending invites{" "}
              <span className="text-zinc-500">({invites.length})</span>
            </h2>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200">
                        {invite.email ?? (
                          <span className="italic text-zinc-500">Open link invite</span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {invite.role} · expires {formatRelativeTime(invite.expiresAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => copyInviteLink(invite.id)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Copy link"
                    >
                      {copiedId === invite.id ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => cancelInvite(invite.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Cancel invite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
