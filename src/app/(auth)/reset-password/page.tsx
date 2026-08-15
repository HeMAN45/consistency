import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "New password · ~/consistency" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="card p-6">
        <h1 className="font-data text-xl tracking-tight">Link incomplete</h1>
        <p className="mt-2 text-sm text-muted">
          That reset link is missing its token. Request a new one.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/forgot-password" className="text-amber hover:text-amber-soft">
            Send another link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h1 className="font-data text-xl tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted">This link works once.</p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
