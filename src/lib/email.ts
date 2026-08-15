/**
 * Email through Resend's HTTP API. No SDK: one fetch call, one fewer
 * dependency to keep current.
 *
 * When RESEND_API_KEY is missing the send is refused and reported, never
 * silently swallowed. A password reset that claims to have sent an email it
 * didn't send is worse than an error.
 */

export type SendResult = { ok: true; id?: string } | { ok: false; reason: string };

const ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    console.warn("[email] RESEND_API_KEY or EMAIL_FROM missing; not sending.");
    return { ok: false, reason: "Email is not configured on this server." };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[email] send failed", response.status, detail);
      return { ok: false, reason: `Provider rejected the message (${response.status}).` };
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id };
  } catch (error) {
    console.error("[email] send threw", error);
    return { ok: false, reason: "Could not reach the email provider." };
  }
}

export function appUrl(path = "") {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}
