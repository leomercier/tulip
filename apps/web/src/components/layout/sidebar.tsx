"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flower2,
  LayoutDashboard,
  Plug,
  Cpu,
  LogOut,
  Users,
  CreditCard,
  ShieldAlert,
  ChevronDown,
  Check,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/hooks/useAuth";
import type { User } from "firebase/auth";
import type { Org } from "@tulip/types";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/integrations", label: "Integrations", icon: Plug },
  { href: "/app/runtime", label: "Runtime", icon: Cpu },
  { href: "/app/org", label: "Members", icon: Users },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

interface SidebarProps {
  user: User;
  orgs: Org[];
  currentOrg: Org | null;
  onSwitchOrg: (orgId: string) => void;
  isSuperAdmin?: boolean;
}

export function Sidebar({ user, orgs, currentOrg, onSwitchOrg, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r border-zinc-800 bg-zinc-950/80 backdrop-blur">
      {/* Logo + org switcher */}
      <div className="border-b border-zinc-800">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-tulip-600/20 ring-1 ring-tulip-500/30 shrink-0">
            <Flower2 className="w-4 h-4 text-tulip-400" />
          </div>
          <p className="text-sm font-semibold text-zinc-100 truncate">Tulip</p>
        </div>

        {/* Org switcher button */}
        <div className="px-3 pb-3 relative">
          <button
            onClick={() => setOrgPickerOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors text-left"
          >
            <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="flex-1 min-w-0 text-xs font-medium text-zinc-300 truncate">
              {currentOrg?.name ?? "No organisation"}
            </span>
            {orgs.length > 1 && (
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform",
                  orgPickerOpen && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Org picker dropdown */}
          {orgPickerOpen && orgs.length > 1 && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    onSwitchOrg(org.id);
                    setOrgPickerOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors text-sm"
                >
                  <div className="w-6 h-6 rounded-md bg-tulip-600/20 ring-1 ring-tulip-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-tulip-400">
                      {org.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="flex-1 min-w-0 text-zinc-200 truncate">{org.name}</span>
                  {org.id === currentOrg?.id && (
                    <Check className="w-3.5 h-3.5 text-tulip-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOrgPickerOpen(false)}
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
                isActive(href, exact) ? "text-tulip-400" : "text-zinc-500"
              )}
            />
            {label}
          </Link>
        ))}

        {/* Super admin link */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:text-red-300 hover:bg-zinc-800/50 transition-colors mt-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            Admin
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-3 py-2">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? "User"}
              className="w-7 h-7 rounded-full ring-1 ring-zinc-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-tulip-600 flex items-center justify-center text-xs font-medium text-white">
              {(user.displayName ?? user.email ?? "U")[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">
              {user.displayName ?? user.email}
            </p>
            {user.displayName && (
              <p className="text-xs text-zinc-600 truncate">{user.email}</p>
            )}
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
  );
}
