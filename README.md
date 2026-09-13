# Chronos Admin

The admin panel for the Chronos backend. React + TypeScript + Vite, no UI
framework — it talks to the same API the mobile app does, so it deploys
anywhere static and needs nothing of its own.

## Run it

```bash
npm install
cp .env.example .env      # then set VITE_API_BASE_URL
npm run dev               # http://localhost:5174
```

`VITE_API_BASE_URL` is the only thing to configure:

| Target | Value |
| --- | --- |
| Local backend | `http://127.0.0.1:8000` |
| Staging (Render) | `https://chronos-backend-zwfh.onrender.com` |

## Administrators are not app users

An administrator is an account in its own tables — `admin_accounts`,
`admin_refresh_tokens`, `admin_audit_logs` — which can live in a **different
database** from the marketplace (`CHRONOS_ADMIN_DATABASE_URL`). There is no flag
on a `users` row that grants admin access, and no route that promotes one.

That is the whole point. An attacker who reaches the marketplace database — a
leaked connection string, an injection, a restored backup — used to be one
`UPDATE users SET is_super_admin = 1` away from a working administrator session.
Now there is nothing there to write: admin password hashes, sessions and the
record of what administrators did are all somewhere else, signed with a
different key (`CHRONOS_ADMIN_SECRET_KEY`).

It does **not** protect against a compromise of the application itself, which
holds the credentials to both. Worth knowing before trusting it further than it
goes.

## Two tiers

**Super admin** — the operator. Created only by putting an address in
`CHRONOS_ADMIN_EMAILS` and restarting: `app/services/admin_bootstrap.py` mints
the account with a generated one-time password, printed once in the startup log.
Holds every permission implicitly, and is the only tier that can create or
re-scope another administrator.

**Admin** — holds exactly the permissions a super admin ticked, and nothing
else. One way to make one: **Create admin**. You give a name, email and phone;
the server mints the account, generates an administrator ID and a password, and
shows them **once**. No signup, no emailed code, nothing needed from the person
first. The password is hashed on arrival and cannot be read back — a lost one is
replaced by issuing another, never recovered.

That password gets them in **once** and no further: the account carries
`must_change_password`, and every `/admin` route refuses it until they pick
their own. Enforced on the server, not just in this panel — a forced change a
caller can skip with curl is not forced. `POST /admin/auth/password/change` is
the one route deliberately outside that check, and changing the password ends
every session, because a handed-over password has usually been seen by more than
its owner.

**Suspend**, not delete. Removing access keeps the account so that everything it
approved stays attributable in the audit trail, and reinstating is one click.

There is no "make someone a super admin" button, and no `admins.manage`
permission. Handing that away would erase the difference between the tiers, so
the only way up is the environment variable — which is controlled by whoever
owns the deployment, not by anyone holding a session.

### Permissions

`users.view`, `users.manage`, `identity.review`, `listings.review`,
`catalog.manage`, `banners.manage`, `markets.manage`, `settings.manage`,
`reports.manage`, `payouts.manage`. The live catalogue with its copy comes from
`GET /admin/permissions`; `src/lib/permissions.ts` mirrors the values.

### Two tiers on the settings screen

`settings.manage` opens the screen and carries the business keys — fees,
commission, payout timings, booking windows, listing caps, pass prices,
discovery, banners, upload size, chat length, live-location tuning and the
per-account rate limits.

The **Sign-in and OTP** and **Abuse budgets** groups are super admin only: OTP
lifetime, resend cooldown and guess budgets, login lockout, the login-OTP
switch, token lifetimes, and the per-IP signup/login/reset budgets. There is no
permission that grants them — same reasoning as "make someone a super admin"
having no button.

Both tiers are **readable** by anyone holding `settings.manage`. An admin who
cannot see the lockout window cannot explain to a user why they are locked out,
and reading a limit is not what the tier exists to restrict. Each row arrives
with `tier` and `canEdit`; the panel disables what it cannot save, and the
server refuses it anyway — `PATCH` and `DELETE` on a super-tier key answer 403.

Two worth knowing before you touch them:

- **Email OTP at login** needs working SMTP. Switching it on with
  `CHRONOS_SMTP_HOST` empty means the code is never delivered and nobody can
  sign in, including whoever flipped it.
- **The abuse budgets** are sized for carrier-grade NAT, where thousands of real
  users on Indian mobile networks share one address. Lowering them locks out
  whole networks, not individuals.

`GET /admin/users` accepts any of `users.view`, `identity.review` or
`listings.review`, because both approval queues are carved out of that one
payload and a reviewer has to be able to load the page they were hired for.

## Sign in

`POST /admin/auth/login` with an administrator ID and password, then
`/admin/auth/me` for who you are and what you may do. One door, one store — the
panel never touches `/auth/*`, which is the marketplace's.

No OTP step and no self-service reset, both on purpose. The OTP machinery
belongs to the marketplace, where `CHRONOS_DEV_STATIC_OTP` pins every code to a
fixed value on non-production deployments; and a "forgot password" flow
reachable from the internet would be a way into the admin store that does not
require the admin store.

## What it covers

Every admin route the API exposes:

| Screen | Endpoints |
| --- | --- |
| Dashboard | queue counts across users, reports, payouts |
| Approvals | identity + listing queues, with the documents |
| Users | list, filter, suspend, reinstate |
| Categories | CRUD, image upload and clear |
| Experience tiers | CRUD |
| Document types | CRUD |
| Category documents | which categories owe which documents |
| Settings | the 58 live-tunable platform keys, in two tiers |
| Markets | countries and the cities under them |
| Currencies | rate, symbol, locale, decimals |
| Banners | CRUD, scheduling, targeting, image |
| Reports | moderation queue |
| Payouts | mark paid / failed |

## Theme

Tabler (tabler.io): its neutral gray ramp, its blue (`#066fd1`), its geometry —
14px body, 6px controls, 8px cards, 12px uppercase table headers, and flat
surfaces separated by a hairline instead of by shadow. The numbers in
`styles.css` were read off the live template rather than eyeballed.

Light is the default; dark follows `prefers-color-scheme` and uses Tabler's own
dark values (`#111827` page, `#1f2937` surfaces, `#374151` borders).

Two things to keep if you retheme it:

- **`--accent` is a fill, `--accent-text` is ink.** The blue is the same in both
  themes because white-on-blue has to keep working; blue *text* on a dark page
  does not, so the text token lightens and the fill does not. In light the ink
  is a step darker than the fill, because the active nav item and the links sit
  on a 10% wash of the blue itself.
- **Every semantic pair needs a dark value, foreground included.** A chip that
  keeps its light-mode ink (dark green on dark green) is how a status column
  becomes unreadable at night.

Tabler's `#2fb344` / `#f59f00` / `#d63939` are made to be fills — none of them
clears 4.5:1 as 11px text on its own tint — so the ink is darkened while the
wash keeps the original hue. Every foreground/background pair in the panel now
clears WCAG AA: worst pair 4.85:1 light, 5.03:1 dark, measured in the browser
rather than assumed.

## Layout

Four modes, driven by width alone:

| Width | Navigation | Tables |
| --- | --- | --- |
| > 1080px | Sticky 224px sidebar | Normal |
| 900–1080px | Sticky 196px sidebar | Normal |
| ≤ 900px | Topbar + slide-over drawer (scrim closes it) | Normal, scrolling inside the card |
| ≤ 720px | Topbar + drawer | Each row becomes a labelled card |

Below 720px a table stops being a table. Seven columns cannot be read at 390px,
and sideways scrolling hides exactly the column the buttons are in — so the
header row is dropped and every cell carries its column name instead. Those
names are injected centrally by `withColumnLabels` in `components/ui.tsx`, so a
page that uses `TableCard` gets it for free and a column added later cannot
forget. The two hand-built tables (Settings, Dashboard) carry `data-label`
themselves.

## Things worth knowing before changing it

- **Responses are wrapped.** Everything comes back as `{ message, data: {...} }`,
  and `lib/api.ts` unwraps `data` for you. The exception is login: the tokens are
  *siblings* of `data`, not inside it, which is why `apiRaw` exists.
- **There is no `GET /admin/listings`.** A listing is nested on its provider's
  row in `/admin/users`, so the approvals page and the sidebar counts both come
  out of that one payload.
- **Banners are asymmetric.** Reads nest the targeting fields under `targeting`;
  writes take them flat (`targetRoles`, `targetMinAge`, …).
- **Markets are hierarchical.** Create the country row first — a city whose
  country does not exist is refused.
- **Identity documents are private.** They are not on the `/files` static mount;
  `GET /admin/identity/files/{id}` streams them to administrators only, with
  `Cache-Control: no-store`.
- **Writes reload rather than patch local state.** One approval changes the user
  row, the listing row and the account status at once, and re-deriving that in
  the browser is how a panel starts lying about what the server holds.

## Deploy

Static build, so any host will do (Vercel, Netlify, Render static, S3):

```bash
npm run build     # -> dist/
```

Set `VITE_API_BASE_URL` in the host's build environment — it is baked in at
build time, not read at runtime.

**Every host needs the SPA rewrite.** Routing is `BrowserRouter`, so `/settings`
is a path the router resolves in the browser and *not* a file on disk. A static
host asked for it finds nothing and answers 404 — which shows up as "the app
works until you refresh, or open a link to anything but `/`". `vercel.json` in
this repo carries the rewrite for Vercel:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Vercel checks the filesystem first, so this does not swallow `/assets/*`. On
Netlify the equivalent is a `_redirects` file with `/*  /index.html  200`; on
Render's static sites it is a rewrite rule of the same shape.

Two things to sort out on the backend side before this is public:

1. **`CHRONOS_ADMIN_AUTH_DISABLED=true` must go.** While it is set, every
   `/admin` route answers with no token, no admin check **and no permission
   check** — the whole tier-and-permission system above is inert, and this
   panel's sign-in screen is the only thing standing between anyone and the
   data. A sign-in screen in a static bundle is not a lock.
2. **CORS.** The API must allow this origin (`CHRONOS_CORS_ORIGINS`), or every
   request fails in the browser while working fine from curl.
