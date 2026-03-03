import { redirect } from "next/navigation";

// Root redirects — middleware handles auth-aware redirect
// If user is authenticated → /app, else → /login
export default function RootPage() {
  redirect("/login");
}
