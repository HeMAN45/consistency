import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="font-data text-[11px] tracking-[0.3em] text-amber">404</p>

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Nothing here.</h1>

      <p className="mt-3 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist, or it belongs to a SYNC you&apos;re not a member of. Those
        look identical on purpose.
      </p>

      <Link
        href="/dashboard"
        className="font-data mt-7 rounded-md bg-amber px-5 py-2.5 text-sm text-void hover:bg-amber-soft"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
