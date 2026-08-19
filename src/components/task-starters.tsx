"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createTaskAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

type Starter = {
  name: string;
  category: "DSA" | "SQL" | "ML" | "HEALTH" | "CUSTOM";
  dayType: "DAILY" | "WEEKDAY" | "SATURDAY" | "SUNDAY";
};

/**
 * Suggestions, not defaults. Nothing is created until you tap it, so the list
 * you end up with is yours rather than one you inherited and had to prune.
 */
const GROUPS: { heading: string; items: Starter[] }[] = [
  {
    heading: "Study",
    items: [
      { name: "DSA problems", category: "DSA", dayType: "WEEKDAY" },
      { name: "DSA lecture", category: "DSA", dayType: "WEEKDAY" },
      { name: "SQL practice", category: "SQL", dayType: "WEEKDAY" },
      { name: "ML lecture", category: "ML", dayType: "WEEKDAY" },
      { name: "Read for 30 minutes", category: "CUSTOM", dayType: "DAILY" },
      { name: "Weekly revision", category: "DSA", dayType: "SATURDAY" },
    ],
  },
  {
    heading: "Body",
    items: [
      { name: "Gym", category: "HEALTH", dayType: "DAILY" },
      { name: "Walk 10k steps", category: "HEALTH", dayType: "DAILY" },
      { name: "Diet on track", category: "HEALTH", dayType: "DAILY" },
      { name: "Stretch", category: "HEALTH", dayType: "DAILY" },
      { name: "Sleep by 11pm", category: "HEALTH", dayType: "DAILY" },
    ],
  },
  {
    heading: "Mind",
    items: [
      { name: "Meditate", category: "HEALTH", dayType: "DAILY" },
      { name: "Journal", category: "CUSTOM", dayType: "DAILY" },
      { name: "No phone before bed", category: "CUSTOM", dayType: "DAILY" },
      { name: "Plan tomorrow", category: "CUSTOM", dayType: "DAILY" },
    ],
  },
];

export function TaskStarters() {
  const router = useRouter();
  const [added, setAdded] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function add(starter: Starter) {
    setAdded((current) => [...current, starter.name]);

    startTransition(async () => {
      await createTaskAction({
        name: starter.name,
        category: starter.category,
        customLabel: null,
        dayType: starter.dayType,
        scheduledDate: null,
        linkUrl: null,
        isCore: true,
      });
      router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">SUGGESTIONS</p>
      <p className="mt-1 text-xs text-faint">
        Tap to add. Nothing here exists until you choose it, and everything is editable after.
      </p>

      <div className="mt-5 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="font-data text-[10px] tracking-widest text-faint">
              {group.heading.toUpperCase()}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.items.map((starter) => {
                const done = added.includes(starter.name);

                return (
                  <button
                    key={starter.name}
                    type="button"
                    disabled={done || pending}
                    onClick={() => add(starter)}
                    className={cn(
                      "font-data flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      done
                        ? "border-good/40 bg-good/10 text-good"
                        : "border-line text-muted hover:border-amber hover:text-amber",
                    )}
                  >
                    {done ? null : <Plus size={11} />}
                    {starter.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
