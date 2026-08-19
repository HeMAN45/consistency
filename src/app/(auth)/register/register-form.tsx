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

      <Field
        label="USERNAME"
        htmlFor="username"
        hint={state.fieldErrors?.username ?? "How friends find you. Letters, numbers, dots, hyphens, underscores."}
        error={Boolean(state.fieldErrors?.username)}
      >
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(state.fieldErrors?.username)}
        />
      </Field>

      <Field
        label="DISPLAY NAME"
        htmlFor="displayName"
        hint={state.fieldErrors?.displayName ?? "What everyone actually sees. Anything you like."}
        error={Boolean(state.fieldErrors?.displayName)}
      >
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
        />
      </Field>

      <Field
        label="EMAIL"
        htmlFor="email"
        hint={state.fieldErrors?.email ?? "Optional. Used only for password resets and reminders."}
        error={Boolean(state.fieldErrors?.email)}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        label="PASSWORD"
        htmlFor="password"
        hint={
          state.fieldErrors?.password ??
          "At least 8 characters. Any characters: capitals, symbols, spaces."
        }
        error={Boolean(state.fieldErrors?.password)}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
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
