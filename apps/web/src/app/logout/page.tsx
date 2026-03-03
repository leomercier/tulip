"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/hooks/useAuth";
import { Flower2 } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    signOut()
      .finally(() => {
        // Clear the session cookie used by middleware
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-tulip-600/20 ring-1 ring-tulip-500/30">
        <Flower2 className="w-7 h-7 text-tulip-400" />
      </div>
      <p className="text-sm text-zinc-500">Signing out…</p>
    </div>
  );
}
