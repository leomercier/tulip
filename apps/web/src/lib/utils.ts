import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function runtimeUrl(subdomain: string): string {
  return `https://${subdomain}`;
}

export function generateInstanceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const short = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `tulip-${short}`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

export type RuntimeStatus =
  | "not_provisioned"
  | "provisioning"
  | "booting"
  | "ready"
  | "error"
  | "deleting";

export const RUNTIME_STATUS_LABELS: Record<RuntimeStatus, string> = {
  not_provisioned: "Not provisioned",
  provisioning: "Provisioning",
  booting: "Booting",
  ready: "Ready",
  error: "Error",
  deleting: "Deleting",
};

export const RUNTIME_STATUS_COLORS: Record<RuntimeStatus, string> = {
  not_provisioned: "text-zinc-500",
  provisioning: "text-yellow-500",
  booting: "text-blue-500",
  ready: "text-green-500",
  error: "text-red-500",
  deleting: "text-orange-500",
};
