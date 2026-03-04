"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signInWithGoogle, useAuth } from "@/lib/hooks/useAuth";
import { Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

function TulipLogo({ className }: { className?: string }) {
  return (
    <svg
      height="36"
      viewBox="0 0 178 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M158.33 33.6721L88.1205 103.882L18.6271 34.3886L34.3885 18.6272L77.3741 61.6128V6.10352e-05H100.3V61.6128L143.285 18.6272L158.33 33.6721Z"
        fill="currentColor"
      />
      <path
        d="M0 77.3742V99.5834H62.3292L18.6271 143.285L34.3885 159.047L79.5234 113.912L42.9856 77.3742H0Z"
        fill="currentColor"
      />
      <path
        d="M136.838 77.3742L99.2251 114.987L143.285 159.047L159.047 143.285L115.345 99.5834H177.674V77.3742H136.838Z"
        fill="currentColor"
      />
    </svg>
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

function LoginForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [user, loading, router, next]);

  async function handleGoogleSignIn() {
    setSigning(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg);
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Toaster
        position="top-center"
        toastOptions={{ className: "!bg-white !text-gray-900 !border !border-gray-200 !shadow-md" }}
      />

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gray-50 border-r border-gray-200 p-12">
        <div className="flex items-center gap-3">
          <TulipLogo className="text-gray-900" />
          <span className="text-base font-semibold text-gray-900">Tulip</span>
        </div>
        <div className="space-y-4">
          <p className="text-3xl font-semibold text-gray-900 leading-snug">
            Isolated runtimes<br />for every team.
          </p>
          <p className="text-sm text-gray-500 max-w-xs">
            Provision OpenClaw instances, connect Slack, and manage your AI agents from one place.
          </p>
        </div>
        <p className="text-xs text-gray-400">agents.tulip.ai</p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <TulipLogo className="text-gray-900" />
            <span className="text-base font-semibold text-gray-900">Tulip</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Welcome back. Sign in to continue.
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={signing}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signing ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <p className="text-center text-xs text-gray-400">
            By continuing you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-white">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
