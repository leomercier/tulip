import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-tulip-600 text-white hover:bg-tulip-500 focus-visible:ring-tulip-500 border-transparent",
    secondary:
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:ring-zinc-500 border-zinc-700",
    ghost:
      "bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-zinc-500 border-transparent",
    destructive:
      "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500 border-transparent",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-6 text-base gap-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
