"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field
        label="USERNAME"
        htmlFor="username"
        hint={state.fieldErrors?.username}
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
        label="PASSWORD"
        htmlFor="password"
        hint={state.fieldErrors?.password}
        error={Boolean(state.fieldErrors?.password)}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
