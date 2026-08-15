import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password · ~/consistency" };

export default function ForgotPasswordPage() {
  return (
    <div className="card p-6">
      <h1 className="font-data text-xl tracking-tight">Reset password</h1>
      <p className="mt-1 text-sm text-muted">
        Enter the email on your account and we&apos;ll send a link.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="text-amber hover:text-amber-soft">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
