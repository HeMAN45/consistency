export const metadata = { title: "Offline · ~/consistency" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="font-data text-[11px] tracking-[0.3em] text-amber">NO CONNECTION</p>

      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">You&apos;re offline.</h1>

      <p className="mt-3 max-w-sm text-sm text-muted">
        Anything you ticked while offline is saved on this device and will sync the moment you have
        signal. Nothing is lost.
      </p>
    </main>
  );
}
