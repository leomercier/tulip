"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/hooks/useAuth";
import { Flower2, Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";

interface InviteDetails {
  orgId: string;
  orgName: string;
  invitedByName: string | null;
  role: string;
  email: string | null;
  expiresAt: string;
}

export default function InvitePage() {
  const params = useParams<{ inviteId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // Fetch invite details (public endpoint)
  useEffect(() => {
    if (!params.inviteId) return;
    fetch(`/api/orgs/invite/${params.inviteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInviteError(data.error);
        } else {
          setInvite(data.invite);
        }
      })
      .catch(() => setInviteError("Failed to load invite"))
      .finally(() => setFetchLoading(false));
  }, [params.inviteId]);

  async function acceptInvite() {
    if (!user || !params.inviteId) return;
    setAccepting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/orgs/invite/${params.inviteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccepted(true);
      // Redirect to the app after short delay
      setTimeout(() => router.replace("/app"), 1500);
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (fetchLoading || authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-tulip-400" />
      </div>
    );
  }

  // ─── Error / expired ────────────────────────────────────────────────────────

  if (inviteError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <div>
            <p className="text-lg font-medium text-zinc-200">Invite unavailable</p>
            <p className="text-sm text-zinc-500 mt-1">{inviteError}</p>
          </div>
          <Button onClick={() => router.replace("/app")} variant="secondary" size="sm">
            Go to app
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  // ─── Accepted ───────────────────────────────────────────────────────────────

  if (accepted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <p className="text-lg font-medium text-zinc-200">You joined {invite.orgName}!</p>
          <p className="text-sm text-zinc-500">Redirecting to the app…</p>
        </div>
      </div>
    );
  }

  // ─── Sign-in gate ────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-tulip-600/20 ring-1 ring-tulip-500/30">
              <Flower2 className="w-6 h-6 text-tulip-400" />
            </div>
            <p className="text-sm font-medium text-zinc-400">Tulip</p>
          </div>

          {/* Invite card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tulip-600/20 ring-1 ring-tulip-500/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-tulip-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {invite.invitedByName ?? "Someone"} invited you to join
                </p>
                <p className="text-lg font-semibold text-zinc-100">{invite.orgName}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              You will join as a{" "}
              <span className="font-medium text-zinc-300">{invite.role}</span>.
              {invite.email && (
                <> This invite is for <span className="font-medium text-zinc-300">{invite.email}</span>.</>
              )}
            </p>
          </div>

          <Button
            className="w-full"
            onClick={async () => {
              await signInWithGoogle();
              // After sign-in, the page re-renders with user set → show accept button
            }}
          >
            Sign in with Google to accept
          </Button>
        </div>
      </div>
    );
  }

  // ─── Signed in — accept button ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-tulip-600/20 ring-1 ring-tulip-500/30">
            <Flower2 className="w-6 h-6 text-tulip-400" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tulip-600/20 ring-1 ring-tulip-500/30 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-tulip-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                {invite.invitedByName ?? "Someone"} invited you to join
              </p>
              <p className="text-lg font-semibold text-zinc-100">{invite.orgName}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-300">{user.email}</span>.
            You will join as a{" "}
            <span className="font-medium text-zinc-300">{invite.role}</span>.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={acceptInvite} loading={accepting} className="w-full">
            Accept and join {invite.orgName}
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.replace("/app")}
            className="w-full"
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
