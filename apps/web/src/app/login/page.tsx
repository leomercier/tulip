"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signInWithGoogle, useAuth } from "@/lib/hooks/useAuth";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Flower2, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

function LoginForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const [signing, setSigning] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  // Handle return from Google redirect
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // onAuthStateChanged in useAuth will fire and handle profile creation
          // the user effect below will do the redirect
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Sign-in failed";
        toast.error(msg);
      })
      .finally(() => {
        setCheckingRedirect(false);
      });
  }, []);

  // Redirect once authenticated
  useEffect(() => {
    if (!loading && !checkingRedirect && user) {
      document.cookie = `__session=${Date.now()}; path=/; SameSite=Lax`;
      router.replace(next);
    }
  }, [user, loading, checkingRedirect, router, next]);

  async function handleGoogleSignIn() {
    setSigning(true);
    try {
      await signInWithGoogle(); // navigates away — page unmounts
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg);
      setSigning(false);
    }
  }

  if (loading || checkingRedirect) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-tulip-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <Toaster position="top-center" toastOptions={{ className: "!bg-zinc-800 !text-zinc-100" }} />

      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-tulip-600/20 ring-1 ring-tulip-500/30">
            <Flower2 className="w-7 h-7 text-tulip-400" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Tulip
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Agent Control Plane</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl backdrop-blur">
          <div className="space-y-2 mb-6">
            <h2 className="text-lg font-medium text-zinc-100">Get started</h2>
            <p className="text-sm text-zinc-500">
              Sign in to your account, or create one if you&apos;re new.
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={signing}
            className="relative flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition-all hover:bg-zinc-700 hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tulip-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-zinc-600">
            By continuing you agree to our terms of service.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-700">
          agents.tulip.ai — isolated runtimes per organisation
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-tulip-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
