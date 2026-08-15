"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordResetAction, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState & { sent?: boolean }, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.sent) {
    return (
      <p className="mt-6 text-sm text-good">
        If that address has an account, a reset link is on its way. It expires in 30 minutes.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="EMAIL" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
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
