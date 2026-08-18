import { cn } from "@/lib/utils";

/**
 * Grouped by what you're actually doing, not by which phase built it. Three
 * columns on desktop, one on mobile, hairline dividers rather than card chrome
 * so it reads as one table of contents instead of nine floating boxes.
 */
const GROUPS: { heading: string; blurb: string; items: [string, string][] }[] = [
  {
    heading: "Do the work",
    blurb: "One screen answers one question: did I actually do it today?",
    items: [
      ["Today's Battle", "Core tasks decide the day. Bonus work earns XP and rescues nothing"],
      ["Problems", "Paste LeetCode or Codeforces links in bulk, solve, click straight through"],
      ["Courses", "A YouTube playlist becomes dated tasks at the pace you choose"],
      ["Focus", "One task, one timer, plain or flip clock, fullscreen, ambient sound"],
      ["Calendar", "Block out the day, declare a rest day in advance"],
    ],
  },
  {
    heading: "See the truth",
    blurb: "Built from what you logged. Nothing estimated, nothing projected.",
    items: [
      ["Rank", "Seven tiers on a rating that falls as readily as it climbs"],
      ["Year heatmap", "Every day of the year, clickable, with that day's detail"],
      ["Momentum", "This week against last, and today against your own average"],
      ["Gaps", "Name why you missed a day. It changes no number, only your pattern"],
      ["Archive", "Every day you logged, done and undone, kept as a record"],
    ],
  },
  {
    heading: "Grow together",
    blurb: "Shared direction. Individual accountability. Never a group score.",
    items: [
      ["SYNC rooms", "One goal, your own target, four ways to view the room"],
      ["Group streak", "Eighty percent of the room clears the day, or it breaks"],
      ["Nudge", "One tap when a member is at risk. One per person per day"],
      ["Seasons", "A start, an end, and a closed record with final standings"],
      ["Share a link", "Pass a problem to a friend. No task, no score, no thread"],
    ],
  },
];

export function FeatureGrid() {
  return (
    <section className="border-b border-line px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-data text-[10px] tracking-[0.32em] text-muted">WHAT YOU GET</p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.heading} className="bg-void p-6">
              <h3 className="text-lg font-semibold tracking-[-0.02em]">{group.heading}</h3>
              <p className="mt-1.5 text-sm text-muted">{group.blurb}</p>

              <dl className="mt-6 space-y-4">
                {group.items.map(([name, detail], index) => (
                  <div
                    key={name}
                    className={cn("border-t border-line pt-4", index === 0 && "border-t-0 pt-0")}
                  >
                    <dt className="font-data text-sm text-ink">{name}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
