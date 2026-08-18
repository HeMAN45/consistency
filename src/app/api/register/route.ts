import { NextResponse } from "next/server";

import { registerSchema } from "@/lib/validation/auth";
import { createUser } from "@/lib/users";
import { clientAddress, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (await isRateLimited("register", clientAddress(request), 5, 60)) {
    return NextResponse.json({ error: "Too many accounts from here. Try later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 422 },
    );
  }

  const result = await createUser(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ id: result.id, username: result.username }, { status: 201 });
}
