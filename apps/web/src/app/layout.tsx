import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tulip — Agent Control Plane",
  description: "Provision and manage isolated AI agent runtimes per organisation.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 font-sans">{children}</body>
    </html>
  );
}
