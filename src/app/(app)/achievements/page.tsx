import type { Metadata } from "next";

import { listAchievements } from "@/lib/achievements";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Achievements · ~/consistency" };

export default async function AchievementsPage() {
  const user = await requireUser();
  const achievements = await listAchievements(user.id);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Achievements</h1>
        <p className="mt-1 text-sm text-muted">
          {unlocked} of {achievements.length} unlocked. Each one is checked against your logged
          history.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {achievements.map((a) => {
          const isUnlocked = Boolean(a.unlockedAt);
          return (
            <li
              key={a.id}
              className={cn("card p-4", isUnlocked ? "border-amber/40" : "opacity-60")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    "font-data text-sm tracking-tight",
                    isUnlocked ? "text-amber" : "text-muted",
                  )}
                >
                  {a.name}
                </p>
                {a.unlockedAt ? (
                  <span className="font-data text-[10px] text-faint">
                    {a.unlockedAt.toISOString().slice(0, 10)}
                  </span>
                ) : (
                  <span className="font-data text-[10px] tracking-widest text-faint">LOCKED</span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted">{a.description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
