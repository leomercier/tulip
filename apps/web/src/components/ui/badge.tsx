import { cn } from "@/lib/utils";
import type { RuntimeStatus } from "@tulip/types";

const STATUS_STYLES: Record<RuntimeStatus, string> = {
  not_provisioned: "bg-zinc-800 text-zinc-400 border-zinc-700",
  provisioning: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
  booting: "bg-blue-900/40 text-blue-400 border-blue-700/50",
  ready: "bg-green-900/40 text-green-400 border-green-700/50",
  error: "bg-red-900/40 text-red-400 border-red-700/50",
  deleting: "bg-orange-900/40 text-orange-400 border-orange-700/50",
};

const STATUS_LABELS: Record<RuntimeStatus, string> = {
  not_provisioned: "Not provisioned",
  provisioning: "Provisioning",
  booting: "Booting",
  ready: "Ready",
  error: "Error",
  deleting: "Deleting",
};

const STATUS_DOT: Record<RuntimeStatus, string> = {
  not_provisioned: "bg-zinc-500",
  provisioning: "bg-yellow-400 animate-pulse",
  booting: "bg-blue-400 animate-pulse",
  ready: "bg-green-400",
  error: "bg-red-400",
  deleting: "bg-orange-400 animate-pulse",
};

interface StatusBadgeProps {
  status: RuntimeStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "success" | "warning";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700",
    outline: "bg-transparent text-zinc-400 border-zinc-700",
    success: "bg-green-900/40 text-green-400 border-green-700/50",
    warning: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
