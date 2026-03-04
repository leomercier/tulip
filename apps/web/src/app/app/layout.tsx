"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/hooks/useAuth";
import { OrgProvider } from "@/lib/context/OrgContext";
import { useOrgContext } from "@/lib/context/OrgContext";
import { Toaster } from "react-hot-toast";

/** Inner layout — needs OrgProvider already mounted */
function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { orgs, currentOrg, loading: orgLoading, profile, setCurrentOrgId } = useOrgContext();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-white">
      <Toaster
        position="top-right"
        toastOptions={{ className: "!bg-white !text-gray-900 !border !border-gray-200 !shadow-md" }}
      />
      <Sidebar
        user={user}
        orgs={orgs}
        currentOrg={currentOrg}
        onSwitchOrg={setCurrentOrgId}
        isSuperAdmin={profile?.superAdmin ?? false}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <OrgProvider uid={user?.uid ?? null}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </OrgProvider>
  );
}
