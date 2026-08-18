/**
 * What the product refuses to do. Every habit tracker lists features; almost
 * none will tell you where they draw a line, and the lines are the reason this
 * one is worth trusting.
 */
const REFUSALS: [string, string][] = [
  [
    "No streak freezes",
    "You can plan a rest day in advance. You cannot buy back a day you already lost.",
  ],
  [
    "No unlimited backfill",
    "Seven days. Beyond that a streak stops being a record and becomes a story.",
  ],
  [
    "No borrowed progress",
    "Group work lives in its own table. Your rank cannot be inflated by anyone else's effort.",
  ],
  [
    "No invented insights",
    "With too little history it says so, rather than drawing a trend through two points.",
  ],
  [
    "No fake integrations",
    "The calendar boundary exists and is empty. Nothing pretends to be synced.",
  ],
  [
    "No chat",
    "A shared room with a message feed stops being a scoreboard. Links pass, threads don't.",
  ],
];

export function Refusals() {
  return (
    <section className="border-b border-line px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-data text-[10px] tracking-[0.32em] text-muted">WHERE THE LINES ARE</p>

        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,5vw,3rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
          The refusals matter more
          <br />
          than the features.
        </h2>

        <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {REFUSALS.map(([title, detail]) => (
            <div key={title}>
              <dt className="font-data text-sm text-amber">{title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
