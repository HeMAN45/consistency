import type { ComebackState } from "@/lib/progression";

/** Shown only when a real streak broke. Direction, not consolation. */
export function ComebackBanner({ state }: { state: ComebackState }) {
  return (
    <section className="card border-amber/40 p-5">
      <p className="font-data text-[11px] tracking-widest text-amber">COMEBACK</p>

      <p className="font-data mt-2 text-lg tracking-tight">
        Day {state.day} / {state.target}
      </p>

      <p className="mt-2 text-sm text-muted">
        A {state.brokenFrom}-day streak ended. Clear today&apos;s core tasks{" "}
        {state.target === state.day ? "once more" : `${state.target - state.day + 1} more times`} to
        rebuild momentum.
      </p>

      <div className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: state.target }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < state.day - 1 ? "bg-amber" : "bg-raised"}`}
          />
        ))}
      </div>
    </section>
  );
}
