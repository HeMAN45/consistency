# QA — Phase 9

Run the automated suite with:

```bash
npm test
```

39 tests, all passing. They cover the logic where a bug would be silent and
expensive: rating maths, timezone boundaries, and scheduling rules.

---

## What the suite covers

**Rating and rank** (`src/lib/rank.test.ts`)

- Tier lookup has no gaps across 0–3000, and boundary ratings resolve upward
  (399 is Newbie, 400 is Pupil).
- The top tier stays open-ended and reports full band progress.
- A day at exactly the 70% expectation line moves the rating by zero.
- Daily change never exceeds +20 or drops below −20 before bonuses.
- **Bonuses cannot rescue a bad day** — steps, wake and a 30-day streak on a
  20% day still produce a negative delta.
- A day with nothing scheduled is neutral, not a punishment.
- The streak bonus is capped at +3 however long the streak runs.
- Consistency ignores rest days rather than scoring them as failures, and stays
  within 0–100 even with an absurd streak value.
- Momentum reports improvement, decline, and flat with no history.
- Focus XP is awarded per completed half hour: 29:59 earns nothing.

**Time** (`src/lib/time.test.ts`)

- 20:30 UTC is already tomorrow in Asia/Kolkata and still today in UTC and
  Los Angeles — the case that breaks naive streak code.
- Day keys round-trip through the Postgres `date` representation, including a
  leap day and a year boundary.
- Shifting crosses month and year ends correctly.
- Weekday/Saturday/Sunday classification, and DAILY tasks applying every day.
- Wake grace: 04:15 counts against an 04:00 goal, 04:16 does not.

**Scheduling** (`src/lib/schedule.test.ts`)

- Blocks that only touch are allowed; partial, full and contained overlaps are
  rejected; the block being edited is excluded from its own check.
- Backfill accepts today and the 7-day edge, rejects day 8 and the future.

---

## Fixed during this phase

1. **The dashboard quote never changed.** It was `findFirst orderBy id asc`, so
   the same line appeared forever. Now one quote per day, stable within the day.
2. **Pure logic was trapped behind the database import.** `isWithinBackfillWindow`
   and the overlap rules lived in modules that instantiate `PrismaClient` on
   import, so they could not be tested. Extracted to `src/lib/backfill.ts` and
   `src/lib/schedule-rules.ts`; the original modules re-export them, so nothing
   else changed.
3. **Shared tasks were creator-only.** Any accepted member can now add one; you
   can remove what you added, and the SYNC creator can remove anything.

---

## Still needs a browser and a second account

These can't be asserted from a unit test. Each one has a specific failure worth
watching for.

**Authorization**

- [ ] Open a SYNC Room URL while signed in as a non-member → 404, identical to a
      SYNC that doesn't exist.
- [ ] Sign out and hit `/dashboard` directly → redirected to `/login`.
- [ ] Invite someone who isn't an accepted friend → rejected.
- [ ] As a non-creator, try to remove another member → rejected.

**SYNC completion ownership**

- [ ] Only your own column in the matrix is clickable; other members' cells are
      static.
- [ ] Complete a SYNC task and confirm your personal rating and streak do not
      move. This is the rule most likely to break silently.

**Timezone**

- [ ] Change your timezone in Settings and confirm the dashboard date header
      follows it, and that the last 7 days replay without the streak jumping.
- [ ] Near local midnight, confirm a task ticked at 23:58 lands on the day you
      expect.

**Streak and replay**

- [ ] Complete every core task → "Perfect day", streak +1, rating climbs.
- [ ] Untick one → the perfect-day state clears and today's gain is withdrawn.
- [ ] Backfill a day from six days ago → the days after it recompute in order.
- [ ] Try to log eight days back → refused with the 7-day message.

**Tasks**

- [ ] Archive a task and confirm past days keep their completion percentages —
      archiving must not rewrite history.
- [ ] Add a task today and confirm yesterday's perfect day is still perfect.

**Interface**

- [ ] Every screen at 360px wide with no horizontal scrolling.
- [ ] Tab through the dashboard: skip link first, visible focus rings, the
      Daily Battle checkboxes operable with Enter and Space.
- [ ] Ctrl+K opens the palette; typing `log steps 10432` records steps; single
      letter shortcuts do nothing while a text field has focus.
