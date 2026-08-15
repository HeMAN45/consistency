import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div aria-hidden className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="rise relative w-full max-w-sm">
        <Link href="/" className="font-data mb-8 block text-lg tracking-tight">
          <span className="text-amber">~/</span>
          <span className="text-ink">consistency</span>
        </Link>
        {children}
      </div>

      <p className="font-data relative mt-10 text-[11px] tracking-widest text-faint">
        PLAN · DO · LOG · MEASURE · IMPROVE
      </p>
    </main>
  );
}
