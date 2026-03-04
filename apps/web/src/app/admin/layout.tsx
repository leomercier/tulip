"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { OrgProvider, useOrgContext } from "@/lib/context/OrgContext";
import { auth } from "@/lib/firebase/client";
import {
  Flower2,
  LayoutDashboard,
  Building2,
  LogOut,
  Loader2,
  ShieldAlert,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/hooks/useAuth";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orgs", label: "Organisations", icon: Building2 },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: orgLoading, profileLoading } = useOrgContext();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Wait for auth, org, AND profile to finish loading before making any decision
    if (authLoading || orgLoading || profileLoading) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    if (!profile?.superAdmin) {
      router.replace("/app");
      return;
    }
    setChecking(false);
  }, [user, authLoading, orgLoading, profileLoading, profile, router]);

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    setSidebarOpen(false);
    await signOut();
    document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.replace("/login");
  }

  function handleNavClick() {
    setSidebarOpen(false);
  }

  if (authLoading || orgLoading || profileLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || !profile?.superAdmin) return null;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Admin sidebar */}
      <aside
        className={cn(
          "flex flex-col w-56 border-r border-gray-200 bg-white",
          "fixed inset-y-0 left-0 z-50 h-full",
          "transform transition-transform duration-200 ease-in-out",
          "md:relative md:h-auto md:min-h-screen md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + badge */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-200">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 ring-1 ring-red-200">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Tulip Admin</p>
            <p className="text-xs text-red-500 truncate">Superadmin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(href, exact)
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive(href, exact) ? "text-red-500" : "text-gray-400"
                )}
              />
              {label}
            </Link>
          ))}

          {/* Return to app */}
          <Link
            href="/app"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors mt-4"
          >
            <Flower2 className="w-4 h-4 shrink-0 text-gray-400" />
            Back to app
          </Link>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-2 py-2">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName ?? "User"}
                className="w-7 h-7 rounded-full ring-1 ring-gray-200 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-xs font-medium text-white shrink-0">
                {(user.displayName ?? user.email ?? "U")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {user.displayName ?? user.email}
              </p>
              <p className="text-xs text-red-500 truncate">superadmin</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-2 py-2 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 -ml-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">Tulip Admin</span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <OrgProvider uid={user?.uid ?? null}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </OrgProvider>
  );
}
