# Deploying JobHacker Compass to Vercel

Next.js (App Router) app. Vercel auto-detects the framework — no build config needed
beyond [`vercel.json`](vercel.json). Firebase = auth + data, Supabase = event logs.

## 1. Push to your Git repo
`.env.local` and the service-account JSON are **git-ignored** — never commit them.
```bash
git add .
git commit -m "JobHacker Compass"
git push   # to your GitHub/GitLab/Bitbucket repo
```

## 2. Import the repo in Vercel
- Vercel → **Add New… → Project** → import your repo.
- Framework preset: **Next.js** (auto). Build command `next build`, output auto.
- Node.js version: **20.x** (pinned via `engines` + `.nvmrc`).

## 3. Set Environment Variables (Project → Settings → Environment Variables)
Add these for **Production** (and Preview, if you want PR previews to work).
`NEXT_PUBLIC_*` are exposed to the browser; the rest are server-only.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `jhg-compass.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `jhg-compass` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `jhg-compass.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `405801804268` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | web app id |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | GA4 id |
| `FIREBASE_SERVICE_ACCOUNT_B64` | **server** — base64 of the service-account JSON (one line) |
| `SUPABASE_URL` | `https://rizumeeeqojhxhaskbmx.supabase.co` |
| `SUPABASE_SECRET_KEY` | **server** — Supabase secret key |
| `COMPASS_WEBHOOK_SECRET` | **server** — shared secret for the access webhook |
| `RESEND_API_KEY` | **server** |
| `RESEND_FROM` | e.g. `JobHacker Compass <compass@yourdomain.com>` |
| `KIT_API_KEY` | **server** (optional) |

> Tip: copy the values from your local `.env.local`. To (re)generate the base64
> service account: `base64 -i serviceAccount.json | tr -d '\n'`.

## 4. Post-deploy wiring
1. **Firebase authorized domains** — Firebase console → Authentication → Settings →
   Authorized domains → add your Vercel domain(s): `your-app.vercel.app` and any custom domain.
2. **Firestore rules** — already live, but redeploy after any change:
   `npm run deploy:rules` (uses the service account; no Firebase login needed).
3. **Resend domain** — verify your sending domain in Resend and set `RESEND_FROM` to it
   (the `onboarding@resend.dev` sandbox only delivers to your own address).
4. **Webhook URL** — point your lead-magnet / payment platform at
   `https://YOUR-DOMAIN/api/webhooks/access` with header `x-compass-secret: <COMPASS_WEBHOOK_SECRET>`.
5. **Registration links** — generated in `/admin`; they automatically use the deployed domain.

## 5. Production checklist
- [ ] Rotate the dev Supabase / Resend / Kit keys and the Firebase service-account key.
- [ ] Set a strong `COMPASS_WEBHOOK_SECRET`.
- [ ] Confirm Email/Password sign-in is enabled in Firebase Auth.
- [ ] Smoke test: register via a link → land on dashboard → log activity → events post.

## Notes
- All server routes use the Node.js runtime (required by `firebase-admin`); Supabase is
  accessed via REST (`fetch`) so there's no WebSocket/Node-version issue on Vercel.
- Event logging writes to the existing `public.jobhackers_leads` table.
