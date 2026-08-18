# Backups

Snapshots of files before a significant rewrite, kept so a change can be
compared or reverted without digging through git history.

| File | What it was |
| --- | --- |
| `landing-page-v2.tsx.bak` | The landing page before the third rewrite: terminal hero, rating machine, spec sheet |
| `sync-preview-v2.tsx.bak` | The SYNC preview component that went with it |

These are not compiled. Restore by copying back over `src/app/page.tsx` and
`src/components/landing/sync-preview.tsx`.
