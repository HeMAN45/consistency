"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { registerAction, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating…" : "Create account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  // Daily boundaries follow the user's zone, so capture it at signup.
  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) setTimezone(resolved);
  }, []);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="timezone" value={timezone} />

      <Field label="USERNAME" htmlFor="username" hint="Lowercase letters, numbers, underscores.">
        <Input id="username" name="username" autoComplete="username" autoFocus required />
      </Field>

      <Field label="DISPLAY NAME" htmlFor="displayName">
        <Input id="displayName" name="displayName" autoComplete="name" required />
      </Field>

      <Field label="EMAIL" htmlFor="email" hint="Optional. Used only for account recovery later.">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>

      <Field label="PASSWORD" htmlFor="password" hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
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
