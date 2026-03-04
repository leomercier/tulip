"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useOrgContext } from "@/lib/context/OrgContext";
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: orgLoading } = useOrgContext();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authLoading || orgLoading) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    // Give profile a moment to load before checking superAdmin
    if (profile !== null) {
      if (!profile.superAdmin) {
        router.replace("/app");
      }
      setChecking(false);
    }
    // If profile is still null but org loading finished, user has no profile yet
    if (!orgLoading && profile === null) {
      router.replace("/app");
    }
  }, [user, authLoading, orgLoading, profile, router]);

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

  if (authLoading || orgLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-tulip-400" />
      </div>
    );
  }

  if (!user || !profile?.superAdmin) return null;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Admin sidebar */}
      <aside
        className={cn(
          "flex flex-col w-60 border-r border-red-900/30 bg-zinc-950/80 backdrop-blur",
          "fixed inset-y-0 left-0 z-50 h-full",
          "transform transition-transform duration-200 ease-in-out",
          "md:relative md:h-auto md:min-h-screen md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + badge */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-red-900/30">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/20 ring-1 ring-red-500/30">
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">Tulip Admin</p>
            <p className="text-xs text-red-400 truncate">Superadmin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(href, exact)
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive(href, exact) ? "text-red-400" : "text-zinc-500"
                )}
              />
              {label}
            </Link>
          ))}

          {/* Return to app */}
          <Link
            href="/app"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors mt-4"
          >
            <Flower2 className="w-4 h-4 shrink-0 text-tulip-500" />
            Back to app
          </Link>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-red-900/30">
          <div className="flex items-center gap-3 px-3 py-2">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName ?? "User"}
                className="w-7 h-7 rounded-full ring-1 ring-red-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-red-700 flex items-center justify-center text-xs font-medium text-white">
                {(user.displayName ?? user.email ?? "U")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">
                {user.displayName ?? user.email}
              </p>
              <p className="text-xs text-red-500 truncate">superadmin</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors mt-0.5"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-red-900/30 bg-zinc-950 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 -ml-1 text-zinc-500 hover:text-zinc-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-zinc-100">Tulip Admin</span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
