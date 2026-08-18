# ~/consistency

A personal discipline operating system. Track DSA, SQL, ML, gym, diet, sleep and
steps in one place, with a Codeforces-style rank that moves against your actual
behaviour, analytics built only from what you logged, and shared goals that
never touch your own progress.

Next.js 16, TypeScript, PostgreSQL, Prisma.

---

## What it does

**A rank you can lose.** Rating moves against a 70% expectation line: clear more
than 70% of your core tasks and you climb, less and you fall, bounded at ±20 a
day. Seven tiers from Newbie to Grandmaster. No streak freezes.

**One daily screen.** Core tasks decide the day; bonus work earns XP and rescues
nothing. Steps, wake time and a note in seconds. Miss a day and name why, which
changes no number and only your pattern.

**Problems.** Paste LeetCode or Codeforces links in bulk. Platform and title are
read from the URL. Optional difficulty and topic tags. Solving one counts as a
task and shows up in analytics by platform, difficulty and topic.

**Courses.** Import a YouTube playlist, pick a pace, and its videos become dated
tasks. The embedded player counts only video actually played, at any speed, so
scrubbing to the end earns nothing. Fall behind and the finish date moves.

**Analytics from real data only.** A full-year heatmap, momentum, per-category
averages, weekly review, personal records. With too little history it says so
rather than drawing a trend through two points.

**SYNC.** Shared goals with individual targets, a group streak, at-risk flags,
nudges, milestones, seasons that close into a read-only record, and a
leaderboard.

**Chat.** Direct threads with friends and one thread per SYNC. Links render as
cards. Messages create no tasks and move no scores.

**Focus mode** with a plain or flip clock, fullscreen and ambient sound. A
**command palette**, **light and dark themes**, and it **installs as a PWA**
with offline logging.

---

## Running it locally

Node 20+ and a PostgreSQL database. [Neon](https://neon.com) has a free tier
that works well.

```bash
git clone <your-repo-url>
cd consistency
npm install
cp .env.example .env
```

Fill in `.env`, then:

```bash
npx prisma db push     # create the tables
npm run db:seed        # achievements and quotes
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Use the **pooled** string in production |
| `DIRECT_URL` | no | Unpooled connection, for migrations |
| `AUTH_SECRET` | yes | Session signing key. Generate with `npx auth secret` |
| `AUTH_URL` | yes | Public base URL |
| `YOUTUBE_API_KEY` | no | Enables the playlist analyzer and Watch tab |
| `RESEND_API_KEY` | no | Enables password reset and reminder emails |
| `EMAIL_FROM` | no | Sender address |
| `CRON_SECRET` | no | Shared secret for the hourly reminder job |
| `DEFAULT_TIMEZONE` | no | Timezone applied to new accounts |

Every optional feature degrades honestly. Without a YouTube key the Watch tab
says it is not configured; without a Resend key password reset refuses rather
than pretending to send an email.

### Getting a YouTube API key

Google Cloud Console, create a project, enable **YouTube Data API v3**, then
Credentials, Create credentials, API key, restricted to that one API. Free quota
is 10,000 units a day; importing a 100-video playlist costs about 4.

### Ambient sound

Optional. Put audio loops in `public/sounds/` named `rain`, `thunder`, `waves`,
`wind`, `fire`, `crickets`, `birds` or `people`, any audio extension. Missing
files simply don't appear in the mixer. CC0 audio only: the folder is public.

---

## Testing

```bash
npm test
```

Covers the logic where a bug would be silent and expensive: rating maths,
timezone boundaries, scheduling rules, playlist arithmetic, problem URL parsing,
group streak thresholds, seasons and the offline queue. `TESTING.md` has the
manual checklist; `QA.md` records what the automated suite covers and what it
cannot.

---

## Deploying

See `DEPLOY.md`. Push to GitHub, import into Vercel, set the environment
variables, and run `npx prisma migrate deploy` against production before the
first deploy. The reminder cron is scheduled in `vercel.json` and needs a Pro
plan; on Hobby, trigger it with `curl`.

---

## Architecture

```
prisma/schema.prisma     the whole data model
src/
  lib/
    rank.ts              rating, tiers, XP, consistency, momentum
    progression.ts       the engine: replays days, writes snapshots
    time.ts              timezone-correct day keys
    analytics.ts         everything the analytics page shows
    problems.ts          practice problems and their statistics
    youtube.ts           YouTube Data API client
    playlists.ts         playlist storage and import
    watch-schedule.ts    turning a plan into dated tasks
    sync*.ts             group streak, seasons, review, leaderboard
    chat.ts              direct and SYNC conversations
    archive.ts           closed seasons and day history
    auth.ts              credentials provider
    session.ts           requireUser, the authoritative gate
  app/
    page.tsx             public landing page
    (auth)/              sign in, register, password reset
    (app)/               everything behind a login
    api/                 register, cron, youtube, sounds
  components/            UI
backup/                  snapshots taken before significant rewrites
```

### Decisions worth knowing

**Rank has one source of truth.** `src/lib/rank.ts` owns rating, tiers, XP and
every score. The columns on `User` are a cache the engine writes.

**Rating decides tier, XP never does.** XP is lifetime effort shown beside the
badge. It cannot promote anyone.

**Editing a past day replays every day after it.** Rating is cumulative, so
`recomputeFrom` rebuilds each snapshot in order. Backfill is capped at 7 days.

**Today is provisional.** An unfinished day never subtracts rating or resets a
streak; the result lands when the day closes in your timezone.

**SYNC work is physically separated from personal work.** `TaskLog` and
`SyncTaskLog` are different tables, so group activity cannot inflate a personal
rank. It is not a rule that could be forgotten; it is a table the rank engine
never queries.

**Days are local, always.** Every date is a `yyyy-MM-dd` key in the user's own
timezone, stored in Postgres `date` columns.

**Prior progress never rewrites history.** Marking forty videos as already
watched records watch progress, not task logs, so a plan moves forward without
inventing forty days of rating and streak.

**Watch time is measured in video, not clock.** The player credits video
position advanced, so 2x playback is credited fairly and seeking earns nothing.

**Client components never import the database.** Labels and pure rules live in
their own modules (`task-labels.ts`, `sync-rules.ts`, `playlist-maths.ts`,
`backfill.ts`, `problem-urls.ts`) so Prisma is never dragged into the browser
bundle. This is also what makes those rules unit testable.

---

## Privacy and security

**Authorisation is server-side and layered.** `src/proxy.ts` does a cheap cookie
check; `requireUser()` is the authoritative gate every page and route handler
starts from. Hiding a field in the UI is never the control.

**Friends see four fields.** Display name, rank, streak, last active. The friend
queries select that shape explicitly, which is also why the friends leaderboard
ranks on rating rather than task completion.

**Knowing a SYNC id grants nothing.** Membership is checked on every read, and a
non-member gets a 404 indistinguishable from the SYNC not existing.

**A member can only ever write their own log.** The user id comes from the
session and is never accepted from the client.

**Passwords** are bcrypt hashed at cost 12. **Reset tokens** are stored as
SHA-256 hashes, expire in 30 minutes, are single use, and invalidate their
siblings. The forgot-password response is identical whether or not the address
exists.

**Sessions** are signed JWTs in httpOnly cookies, valid seven days, refreshed
daily.

**Rate limits** live in Postgres so they survive cold starts: login,
registration, password reset, nudges, chat, and the playlist analyzer.

**Security headers** including a Content Security Policy, `frame-ancestors
'none'`, and HSTS. One honest caveat: `script-src` still allows
`'unsafe-inline'` because Next ships an inline bootstrap; removing it needs a
per-request nonce.

**The database retries connection failures**, so a sleeping serverless instance
costs a slow first request rather than an error page.

---

## Not built, deliberately

Watch verification from YouTube. Watch history is not exposed by any API, so the
player measures what it can observe.

Automatic calendar synchronisation. The integration boundary exists in
`src/lib/calendar/provider.ts` and is empty; faking the rest would be worse than
leaving it honest.

Codeforces and LeetCode solve verification. Dropped on purpose: LeetCode has no
public API, and a verification that works for one platform and silently fails
for another is worse than an honest tick.
