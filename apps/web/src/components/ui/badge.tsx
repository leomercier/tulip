import { cn } from "@/lib/utils";
import type { RuntimeStatus } from "@tulip/types";

const STATUS_STYLES: Record<RuntimeStatus, string> = {
  not_provisioned: "bg-gray-100 text-gray-600 border-gray-200",
  provisioning: "bg-amber-50 text-amber-700 border-amber-200",
  booting: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-green-50 text-green-700 border-green-200",
  error: "bg-red-50 text-red-700 border-red-200",
  deleting: "bg-orange-50 text-orange-700 border-orange-200",
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
  not_provisioned: "bg-gray-400",
  provisioning: "bg-amber-500 animate-pulse",
  booting: "bg-blue-500 animate-pulse",
  ready: "bg-green-500",
  error: "bg-red-500",
  deleting: "bg-orange-500 animate-pulse",
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
    default: "bg-gray-100 text-gray-700 border-gray-200",
    outline: "bg-transparent text-gray-600 border-gray-300",
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
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
