# Deploying (Phase 10)

## Environment variables

Set these in Vercel, Project Settings, Environment Variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon connection string |
| `AUTH_SECRET` | Generate with `npx auth secret` |
| `AUTH_URL` | Your production URL, e.g. `https://consistency.vercel.app` |
| `RESEND_API_KEY` | From resend.com, API Keys |
| `EMAIL_FROM` | `consistency <onboarding@resend.dev>` until you verify a domain |
| `CRON_SECRET` | Any long random string. Vercel sends it to the cron route |
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` |

## Migrations

`npm run build` runs `prisma generate`, not `migrate`. Apply migrations from your
machine against the production database before the first deploy:

```bash
npx prisma migrate deploy
```

## Reminders

`vercel.json` schedules `/api/cron/reminders` hourly. Vercel sends
`Authorization: Bearer $CRON_SECRET`; the route rejects anything else with a 401.
The route works out who is due from each user's own timezone, which is why it
runs every hour rather than once a day.

Cron jobs need a Vercel Pro plan. On Hobby, trigger it yourself:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/reminders
```

## Email deliverability

`onboarding@resend.dev` works immediately but only sends to the address that
owns the Resend account. To email anyone else, verify a domain in Resend and
change `EMAIL_FROM`.

## After deploying

- [ ] Create an account on production and confirm the dashboard loads
- [ ] Request a password reset and check the email arrives
- [ ] Hit the cron URL manually and confirm it returns `{"checked":n,...}`
- [ ] Confirm your timezone is right, the date header follows it
- [ ] Open a SYNC room URL while signed out, you should land on `/login`
