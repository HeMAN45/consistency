import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account · ~/consistency" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="card p-6">
      <h1 className="font-data text-xl tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-muted">
        Starts you at Newbie, with a default task set you can edit right away.
      </p>

      <RegisterForm />

      <p className="mt-6 text-sm text-muted">
        Already tracking?{" "}
        <Link href="/login" className="text-amber hover:text-amber-soft">
          Sign in
        </Link>
      </p>
    </div>
  );
}
