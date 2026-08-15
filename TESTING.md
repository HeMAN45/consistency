# Test list

Everything to check by hand, grouped by feature, with the output you should see.
Automated coverage runs with `npm test` (57 tests).

Setup first:

```bash
npm install
npx prisma db push
npm test
npm run dev
```

Some checks need a **second account**. Register one in a private window.

---

## 1. Foundation

| Do | Expect |
| --- | --- |
| Sign out, open `/dashboard` | Redirected to `/login` |
| Sign in with a wrong password | "Wrong username or password", never "no such user" |
| Open `/` while signed in | Straight to the dashboard, no landing page |
| Open `/` while signed out | Landing page, different quote on each reload |

## 2. Daily loop and rating

| Do | Expect |
| --- | --- |
| Tick one core task | Bar moves, percentage updates instantly |
| Tick every core task | "Perfect day. Rating banked.", streak +1, rating rises |
| Untick one | Perfect-day state clears, today's gain is withdrawn |
| Save steps above your goal and a wake time within 15 min | Rating rises again |
| Log a day 6 days back | Accepted, later days recompute |
| Try 8 days back | Refused: "You can only log the last 7 days" |

## 3. Tasks

| Do | Expect |
| --- | --- |
| Add a task, set schedule to "One day only", pick a date 3 days out | Saved, row shows the date instead of a recurrence |
| Check the dashboard today | The one-off task is absent |
| Add a Custom category task, name the category "Guitar" | "GUITAR" on the row, its own line in Analytics |
| Archive a task | Disappears from today, past percentages unchanged |
| Reorder with the arrows | Order persists after refresh |

## 4. Evidence and gaps

| Do | Expect |
| --- | --- |
| Complete a task, click "+ ADD PROOF", paste a URL | Link icon appears, opens in a new tab |
| Untick that task | Proof is cleared with it |
| After an incomplete day passes | "Gaps this week" lists it |
| Tag it "Travelling" | Chip highlights, **rating and streak do not change** |
| Reload | Tag persists, steps and wake time still intact |

## 5. Rest days

| Do | Expect |
| --- | --- |
| Calendar, tomorrow, "Declare rest day" | Confirmed, counter shows 1/4 this month |
| Wait for that day (or set one for today) | Cannot declare: needs a day's notice |
| Try to declare a past day | Refused: "Yesterday can't become one" |
| Declare 5 in one month | Fifth refused |
| On a rest day | Streak holds, rating does not move, day not counted as a miss |

## 6. Calendar

| Do | Expect |
| --- | --- |
| Use the date field to jump to next month | Loads that day directly |
| "+1 week" / "+1 month" | Jumps forward correctly |
| Add a block 08:00 to 09:30 | Appears in the list |
| Add another 09:00 to 10:00 | Refused as overlapping |
| Add one 09:30 to 10:30 | Accepted, touching is allowed |
| Link a block to a task | Task stays unticked on the dashboard |

## 7. Analytics

| Do | Expect |
| --- | --- |
| Open Analytics with under 3 tracked days | "Log a few more days" rather than invented insights |
| Tap a heatmap square | That day's completion, core count, steps, wake time |
| Check Today vs Average | Categories listed with arrows, custom labels by their own name |

## 8. Focus, palette, achievements

| Do | Expect |
| --- | --- |
| Start a 25 minute session, finish early after 30+ minutes elapsed | "+10 XP" per completed half hour |
| Stop a session early | "Nothing awarded" |
| Press `Ctrl+K` | Palette opens |
| Type `log steps 10432`, Enter | Steps recorded, dashboard updates |
| Press `D`, `T`, `F`, `C`, `A`, `S` outside a text field | Navigates |
| Type a letter inside a text field | Nothing navigates |
| Complete your first perfect day | "First Blood" unlocks, celebration appears |

## 9. Friends and privacy

| Do | Expect |
| --- | --- |
| Add the second account by username | Request sent |
| Accept from the other side | Both appear as friends |
| Look at your friend's card | Name, rank, streak only. No tasks, metrics or heatmap anywhere |
| Send a request to a username that doesn't exist | "No account with that username" |

## 10. SYNC

| Do | Expect |
| --- | --- |
| Create a SYNC, invite your friend, set an end date | Room opens, banner shows "Day 1 of N" |
| Invite someone who is not a friend | Refused |
| Open the room URL from a non-member account | 404, identical to a SYNC that doesn't exist |
| Add a shared task from the **non-creator** account | Allowed |
| Remove a task you didn't add, as non-creator | Refused |
| Click X on a task you added | Asks to confirm before removing |
| Switch views: Board, People, Tasks, Activity | All four render, choice remembered after reload |
| Try to tick another member's cell | Not clickable |
| Complete a SYNC task | **Your personal rating and streak do not move** |
| Check group streak | Today's percentage against the 80% line |
| Have one of two members complete everything | 50%, below the bar, streak does not advance |
| After 6pm local with work still open | "AT RISK" on that member |
| Click NUDGE | "Nudged X", button becomes NUDGED, second attempt refused today |
| Turn nudges off in Settings, from the other account | Nudge button no longer appears for them |
| Reach 25% group progress | Milestone marker fills |
| Check the weekly review | Week vs last week, your own private comparison line |
| Set an end date in the past | Room becomes read-only, final standings shown, ticking refused |

## 11. Email

Needs `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` in `.env`. Note that
`onboarding@resend.dev` only delivers to the address that owns the Resend account.

| Do | Expect |
| --- | --- |
| Settings, add your email, save | Saved |
| Sign out, "Forgot password?", enter it | "If that address has an account…" |
| Enter an address with no account | Identical message, no leak |
| Open the emailed link | Reset form |
| Set a new password, then reuse the same link | "Expired or already used" |
| Sign in with the new password | Works |
| Enable reminders, set the time to a few minutes ahead | Saved |
| `curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/reminders` | JSON `{"checked":n,"sent":n,"skipped":n}` |
| Same without the header | 401 |
| Run it after completing every core task | `sent: 0`, nothing to nag about |

## 12. PWA and offline

| Do | Expect |
| --- | --- |
| Open the site on your phone, browser menu, "Add to home screen" | Icon on the home screen |
| Open from that icon | Fullscreen, no address bar |
| DevTools, Network, "Offline", then tick a task | Box fills, pill reads "Offline · 1 saved here" |
| Reload while still offline | Offline page, queue survives |
| Go back online | Pill shows syncing, then disappears; rating updates |
| Tick and untick the same task twice offline, then reconnect | One request, final state only |

## 13. Interface

| Do | Expect |
| --- | --- |
| Every screen at 360px wide | No horizontal scrolling, no clipped text |
| Tab from the top of the dashboard | Skip link first, then visible focus rings |
| Space and Enter on a task checkbox | Toggles |
| Throttle the network, navigate between screens | Skeletons, not blank flashes |
| Visit a URL that doesn't exist | The 404 page |

---

## Report back

For anything that fails, tell me: the page, what you did, what you expected, and
the exact error from the terminal or the browser. The terminal output is usually
more specific than the screen.
