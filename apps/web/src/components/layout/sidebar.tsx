"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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
  BarChart2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/hooks/useAuth";
import type { User } from "firebase/auth";
import type { Org } from "@tulip/types";
import { useState } from "react";

function TulipLogo({ className }: { className?: string }) {
  return (
    <svg
      height="26"
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

const NAV_ITEMS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/integrations", label: "Integrations", icon: Plug },
  { href: "/app/runtime", label: "Runtime", icon: Cpu },
  { href: "/app/inference", label: "Inference", icon: Layers },
  { href: "/app/usage", label: "Usage", icon: BarChart2 },
  { href: "/app/org", label: "Members", icon: Users },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

interface SidebarProps {
  user: User;
  orgs: Org[];
  currentOrg: Org | null;
  onSwitchOrg: (orgId: string) => void;
  isSuperAdmin?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, orgs, currentOrg, onSwitchOrg, isSuperAdmin, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  async function handleSignOut() {
    onClose?.();
    await signOut();
    router.replace("/login");
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  function handleNavClick() {
    setOrgPickerOpen(false);
    onClose?.();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex flex-col w-56 border-r border-gray-200 bg-white",
          // Mobile: fixed drawer, off-screen when closed
          "fixed inset-y-0 left-0 z-50 h-full",
          "transform transition-transform duration-200 ease-in-out",
          // Desktop: normal sidebar in document flow
          "md:relative md:h-auto md:min-h-screen md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + org switcher */}
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <TulipLogo className="text-gray-900 shrink-0" />
            <span className="text-sm font-semibold text-gray-900">Tulip</span>
          </div>

          {/* Org switcher */}
          <div className="mt-3 relative">
            <button
              onClick={() => setOrgPickerOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors text-left"
            >
              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">
                {currentOrg?.name ?? "No organisation"}
              </span>
              {orgs.length > 1 && (
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform",
                    orgPickerOpen && "rotate-180"
                  )}
                />
              )}
            </button>

            {orgPickerOpen && orgs.length > 1 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      onSwitchOrg(org.id);
                      setOrgPickerOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors text-sm"
                  >
                    <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">
                        {org.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="flex-1 min-w-0 text-gray-800 truncate">{org.name}</span>
                    {org.id === currentOrg?.id && (
                      <Check className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
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
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}

          {isSuperAdmin && (
            <Link
              href="/admin"
              onClick={handleNavClick}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors mt-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Admin
            </Link>
          )}
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
              {user.displayName && (
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              )}
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
    </>
  );
}
