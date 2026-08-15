import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · ~/consistency" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="card p-6">
      <h1 className="font-data text-xl tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Pick up where yesterday left off.</p>

      <LoginForm />

      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-muted">
        <span>
          No account yet?{" "}
          <Link href="/register" className="text-amber hover:text-amber-soft">
            Create one
          </Link>
        </span>
        <Link href="/forgot-password" className="text-muted hover:text-ink">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
