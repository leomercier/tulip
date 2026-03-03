"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flower2,
  LayoutDashboard,
  Plug,
  Cpu,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/hooks/useAuth";
import type { User } from "firebase/auth";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/integrations", label: "Integrations", icon: Plug },
  { href: "/app/runtime", label: "Runtime", icon: Cpu },
];

interface SidebarProps {
  user: User;
  orgName?: string;
}

export function Sidebar({ user, orgName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    // Clear session cookie
    document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.replace("/login");
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r border-zinc-800 bg-zinc-950/80 backdrop-blur">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-tulip-600/20 ring-1 ring-tulip-500/30">
          <Flower2 className="w-4 h-4 text-tulip-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">Tulip</p>
          {orgName && (
            <p className="text-xs text-zinc-500 truncate">{orgName}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
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
