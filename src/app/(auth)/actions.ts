"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { createUser } from "@/lib/users";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

export type FormState = { error?: string };

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: never reveal whether the username exists.
      return { error: "Wrong username or password." };
    }
    throw error; // redirect() throws internally and must bubble
  }

  return {};
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    email: formData.get("email") ?? "",
    timezone: formData.get("timezone") || "Asia/Kolkata",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const result = await createUser(parsed.data);
  if (!result.ok) return { error: result.error };

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }

  return {};
}

// ---------------------------------------------------------- password reset

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState & { sent?: boolean }> {
  const { z } = await import("zod");
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());

  if (!parsed.success) return { error: "Enter a valid email address." };

  const { db } = await import("@/lib/db");
  const { createResetToken } = await import("@/lib/password-reset");
  const { sendEmail, appUrl, emailConfigured } = await import("@/lib/email");

  if (!emailConfigured()) {
    return { error: "Email isn't set up on this server yet." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, displayName: true, email: true },
  });

  // Always report the same thing, so this can't be used to discover who has an
  // account here.
  const generic = { sent: true } as const;

  if (!user?.email) return generic;

  const created = await createResetToken(user.id);
  if (!created) return generic; // rate limited, silently

  const link = appUrl(`/reset-password?token=${created.token}`);

  await sendEmail({
    to: user.email,
    subject: "Reset your ~/consistency password",
    text: [
      `Hi ${user.displayName},`,
      "",
      "Use the link below to set a new password. It expires in " +
        `${created.expiresInMinutes} minutes and works once.`,
      "",
      link,
      "",
      "If you didn't ask for this, ignore it. Your password stays as it is.",
      "",
      "~/consistency",
    ].join("\n"),
  });

  return generic;
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState & { done?: boolean }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Those passwords don't match." };

  const { passwordSchema } = await import("@/lib/validation/auth");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Password is too short." };

  const { consumeResetToken, markTokenUsed } = await import("@/lib/password-reset");
  const record = await consumeResetToken(token);
  if (!record) return { error: "That link has expired or was already used." };

  const bcrypt = (await import("bcryptjs")).default;
  const { db } = await import("@/lib/db");

  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data, 12) },
  });

  await markTokenUsed(record.id, record.userId);

  return { done: true };
}
