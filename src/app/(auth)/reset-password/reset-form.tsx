"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { resetPasswordAction, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState & { done?: boolean }, FormData>(
    resetPasswordAction,
    {},
  );

  if (state.done) {
    return (
      <div className="mt-6">
        <p className="text-sm text-good">Password updated.</p>
        <Link
          href="/login"
          className="font-data mt-4 inline-block rounded-md bg-amber px-4 py-2 text-sm text-void hover:bg-amber-soft"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      <Field label="NEW PASSWORD" htmlFor="password" hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
        />
      </Field>

      <Field label="CONFIRM" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
