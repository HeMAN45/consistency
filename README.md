# ~/consistency

A personal discipline operating system. Built against PRD v4.

**Status: Phases 1–9 complete, plus email, SYNC views, Phases 11 to 14, and PWA install with offline logging. Deployment is yours (see DEPLOY.md).**

---

## Run it

```bash
npm install                   # postinstall runs `prisma generate`
cp .env.example .env          # set DATABASE_URL, then: npx auth secret
npx prisma migrate dev --name init
npm run db:seed
npm run dev
npm test                      # 39 unit tests — see QA.md
```

Open `http://localhost:3000`, create an account, and you land on the dashboard
with a Newbie badge and the default task set already seeded.

> The Prisma schema in this repo was hand-verified, not machine-validated —
> `prisma validate` needs to download engine binaries. Run
> `npx prisma validate` locally before the first migration.

---

## Stack

| Layer      | Choice                                   |
| ---------- | ---------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)       |
| Language   | TypeScript, strict                       |
| Styling    | Tailwind CSS v4 (CSS-first `@theme`)     |
| Database   | PostgreSQL + Prisma 6                    |
| Auth       | Auth.js v5, credentials provider, JWT    |
| Hashing    | bcryptjs                                 |
| Validation | Zod                                      |
| Charts     | Recharts (Phase 3)                       |

Three deviations from the PRD's stack table, all deliberate:

1. **Next.js 16, not 14.** 16.2 is current. It renames `middleware.ts` to
   `proxy.ts` and the exported function from `middleware` to `proxy` — see
   `src/proxy.ts`.
2. **`bcryptjs`, not `bcrypt`.** Same algorithm, no native build step, which
   matters on Vercel. Swap the import if you ever move off serverless.
3. **Tailwind v4.** Config lives in `src/app/globals.css` under `@theme`, so
   there is no `tailwind.config.ts`.

---

## Architecture decisions worth knowing

**Rank has exactly one source of truth.** `src/lib/rank.ts` owns rating, tier
boundaries, XP and every score. Nothing else computes progression. `User.rating`,
`tier`, `xp` and streak columns are a cache the engine writes; they are never
updated ad hoc from a route handler.

**Rating decides tier. XP never does.** The PRD points two ways here — §25 says
rank comes from consistency, §28 shows an XP bar under the rank. Resolution: the
bar under the badge is rating progress through the current band; XP is lifetime
effort shown beside it. XP alone cannot promote anyone.

**The calendar never fakes a sync.** `src/lib/calendar/provider.ts` defines the
interface an external provider must implement and keeps an empty registry.
`fetchExternalEvents` throws when nothing is connected rather than returning an
empty list, so a missing integration can't be mistaken for an empty day. Plan
and record stay separate: a schedule block describes intent, and only ticking a
task changes the rating.

**Offline ticks are queued, not lost.** `src/lib/offline-queue.ts` collapses
repeated toggles of the same task and day to their final state, survives a
reload, replays oldest first when the connection returns, and drops entries the
server refuses on their merits rather than retrying them forever. The service
worker never caches or replays mutations: only the queue knows what a duplicate
would mean.

**The rating stays server-side, and the interface says so.** An offline tick
fills the box immediately but the rank only moves once it syncs, which the
status pill states plainly instead of showing a number that isn't real.

**Seasons close, and closed means closed.** A SYNC gets a start and an optional
end date. Once the end passes, the room becomes a read-only record with final
standings: no completions, no new shared tasks. Finite commitments get finished.

**The weekly comparison never leaks personal data.** A member is compared
against their own SYNC history, not their personal tasks, so the line can appear
in a shared room without exposing anything private. Each member sees only their
own.

**The group streak forgives one person, not two.** A day counts when 80% of
member-task slots are filled, and a member who declared a rest day leaves the
denominator instead of counting as a failure. Today can extend the streak but
never break it, the same provisional rule personal streaks follow.

**Nudges are rate limited by a unique index**, not by a check that could race:
one per sender, per recipient, per SYNC, per day. Recipients can switch them off
entirely, and the button only appears when someone is genuinely at risk.

**Rest days are declared, never granted retroactively.** Scheduling Sunday off
a week ahead is a plan; forgiving yesterday is an excuse. The server refuses
anything inside 24 hours, caps them at 4 a month, and treats a rest day as
"nothing scheduled": rating holds, streak holds, no miss recorded.

**Miss reasons change no number.** Tagging a gap as travel or illness is for
the user's own pattern-spotting. `missReason` is deliberately absent from every
rating input, and is written by a dedicated action so tagging can never
overwrite steps or wake time.

**Password reset tokens are stored hashed.** Only the SHA-256 hash reaches the
database, so a leaked table can't be replayed into account takeover. Tokens are
single use, expire in 30 minutes, and invalidate their siblings when used. The
"forgot password" response is identical whether or not the address exists.

**Email refuses rather than pretends.** Without `RESEND_API_KEY` the send
returns an error instead of quietly doing nothing, because a reset that claims
to have sent an email it didn't send is worse than a visible failure.

**The privacy contract lives in `src/lib/friends.ts`.** Friend queries select an
explicit four-field shape — name, rank, streak, last active — so no future
change can accidentally widen it. Knowing a SYNC id grants nothing either:
`requireMembership` checks the database on every read, and a non-member gets a
404 indistinguishable from the SYNC not existing.

**A member can only write their own SYNC log.** The user id comes from the
session and is never accepted from the client, so ticking a box for someone else
isn't a rule to enforce — it's an argument that doesn't exist.

**SYNC goal progress is earned, not typed.** It counts the days a member
completed at least one of the SYNC's tasks since the goal's start date.

**Achievements are derived, never incremented.** Every rule is a question asked
of stored rows (`src/lib/achievements.ts`), so replaying history can't inflate
them and a bug can't award something the data doesn't support.

**Comeback mode is computed, not stored.** If a streak of 3+ ended in the last
week, the next three days read as a rebuild — derived from snapshots on the fly.

**Focus never touches the streak.** Sessions earn XP per completed half hour and
nothing else; core completion stays the only path to a perfect day.

**Today is provisional.** An unfinished day never subtracts rating and never
resets the streak. The full delta lands once the day closes in the user's
timezone and a later day replays over it — so a half-done day at 2pm doesn't
read as a loss.

**Editing a past day replays every day after it.** Rating is cumulative, so
`recomputeFrom` rebuilds each snapshot in order and carries rating and streak
forward. Backfill is capped at 7 days; unlimited backfill turns a streak into
fiction.

**Rating moves against a 70% expectation line.** Hit 70% of core tasks and you
hold, beat it and you climb, miss it and you fall, bounded at ±20/day. Bonuses
(perfect day, steps, wake) add to a good day and never rescue a bad one. Legible
by design — a user should be able to explain their own delta.

**SYNC work is physically separated from personal work.** `TaskLog` and
`SyncTaskLog` are different tables. The rank engine reads only `TaskLog`, so
farming personal rank through a SYNC is not a rule that can be forgotten — it is
a table that does not exist in the query.

**Days are local, always.** `src/lib/time.ts` converts instants to a `yyyy-MM-dd`
day key in `User.timezone`, and Postgres `date` columns store that key. Nothing
in the codebase derives a day from a raw UTC instant.

**Authorization is server-side and layered.** `src/proxy.ts` does a cheap
cookie check for fast redirects. `requireUser()` in `src/lib/session.ts` is the
authoritative gate and every page and route handler starts there. Hiding fields
in the UI is never the control.

**Login is rate limited in Postgres** (`LoginAttempt`), so it survives
serverless cold starts, and a missing user is compared against a dummy hash so
wrong-username and wrong-password take the same time.

---

## Layout

```
prisma/
  schema.prisma        full data model, all phases
  seed.ts              achievements + original quotes
src/
  proxy.ts             Next 16 route gating (was middleware.ts)
  lib/
    rank.ts            rating, tiers, XP, consistency, momentum
    time.ts            timezone-correct day keys
    auth.config.ts     edge-safe half (no Prisma, no bcrypt)
    auth.ts            credentials provider
    session.ts         requireUser / assertOwner
    users.ts           account creation, shared by action + API
    rate-limit.ts      login throttling
    default-tasks.ts   PRD §63 starter set
    validation/        Zod schemas
  app/
    page.tsx           public landing page (per-request quote)
    (auth)/            sign in, create account
    (app)/             shell + dashboard + phase placeholders
    api/register       JSON account creation
  components/
    rank-badge.tsx     hero + small variants
    command-palette.tsx  Ctrl+K, shortcuts, `log steps 10432`
    celebration.tsx    rank up / perfect day / unlock overlay
    focus-timer.tsx    wall-clock session timer
    app-nav.tsx        sidebar (desktop) + tab bar (mobile)
```

---

## Two setup gotchas (already fixed here)

Both bite again on a fresh clone or on Vercel, so they are worth knowing:

1. **`proxy.ts` needs a plain function export.** Next 16 statically checks for
   one, so Auth.js's `export const { auth: proxy } = NextAuth(...)` is rejected.
   Assign first, then `export default auth`.
2. **`prisma.config.ts` stops the CLI loading `.env`.** With a config file
   present, Prisma no longer reads `.env` automatically — hence
   `import "dotenv/config"` at the top of it. Without that line every CLI
   command fails with "Environment variable not found: DATABASE_URL", while
   Next.js itself works fine.

## Roadmap

| Phase | Scope                                                        | State |
| ----- | ------------------------------------------------------------ | ----- |
| 1     | Schema, auth, authorization, validation, design system, shell | done  |
| 2     | Tasks, TaskLogs, metrics, Daily Battle, rating engine, XP     | done  |
| 3     | Heatmap, trends, insights, rank history, weekly review        | done  |
| 4     | Achievements, rank-up, perfect day, comeback mode             | done  |
| 5     | Focus mode, command palette, shortcuts                        | done  |
| 6     | Friends, requests, SYNC, SYNC Room, multi-SYNC                | done  |
| 7     | Calendar foundation and integration boundary                  | done  |
| 8     | Responsive, typography, motion, skeletons, empty states, a11y | done  |
| 9     | QA against §67 acceptance criteria                            | done  |
| 10    | Migrations, env, Vercel deploy, verification                  | next  |

`src/components/phase-placeholder.tsx` keeps every nav destination resolving to
something during the build. It is deleted at the end of Phase 8.
