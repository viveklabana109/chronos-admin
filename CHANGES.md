# Changelog — chronos-admin

Notable changes to the admin panel. Dates are absolute. The backend half of each
of these is in `chronos-backend/CHANGES.md` under the same date.

---

## 2026-09-13 — Sign-in moved to the panel's own door

Sign-in used to be two calls, and the reason was structural: `/auth/login`
proved the password but could not say whether the account was an administrator,
because both were the same `users` row with a flag between them. So the panel
signed in, then asked `/auth/me` who it was, and locked the door itself if the
answer was no. A check the client performs is a courtesy, not a defence.

Administrators are their own accounts in their own database now, so
`POST /admin/auth/login` either returns an admin session or it does not. There
is no non-admin who can sign in here, and nothing to verify afterwards.

Two things went away with it, both deliberately:

* **The OTP step.** The code path it used belongs to the marketplace, where
  `CHRONOS_DEV_STATIC_OTP` pins every code to a fixed value on non-production
  deployments. An admin door that opened to `123456` would have been worse than
  no door.
* **Any way back in from outside.** There is no self-service reset. An admin
  password is issued by another administrator and replaced by its owner; a
  "forgot password" flow reachable from the internet would be a way into the
  admin store that does not require the admin store.

Signing out now tells the server, and ends **every** session rather than this
one. That is not laziness: revoking the refresh token leaves the access token it
came with working for up to its full life, and the only thing that refuses an
already-minted token is a per-account cutoff. On a panel that approves KYC and
settles money, someone signing out on a shared machine means it.

Changing a handed-over password also ends every session, so the panel signs back
in afterwards rather than pretending the old one survived.

---

## 2026-09-13 — The Administrators screen: one way in, and suspend instead of remove

**"Grant to existing account" is gone.** It took a Chronos ID or an email and
made that marketplace account an administrator. There is no such account to
promote any more — and that is the point of the change underneath it: a row in
`users` cannot become an administrator no matter who writes it. Creating one is
now the only way, and it mints a fresh account with its own ID and password,
shown once.

**"Remove" is now "Suspend".** Deleting the account would turn every identity it
ever approved into an unattributable entry in the audit trail. Suspension ends
their sessions immediately — not at the next sign-in, now — and a Reinstate
action brings them back. Super admins can be neither, because that tier comes
from `CHRONOS_ADMIN_EMAILS` and a restart; accepting the request would be
theatre.

Still no "make someone a super admin" button, and still no `admins.manage`
permission. Handing that away would erase the difference between the tiers.

---

## 2026-09-13 — The settings screen: 58 keys, in two tiers

It carried 27 keys. It carries 58 — the OTP policy, the login lockout, token
lifetimes, the per-address abuse budgets, upload size, chat length, the
live-location tuning the app polls on every session, the provider pass prices.
All of them were environment variables that needed a redeploy to move.

The screen is split by who may write what. `settings.manage` carries the
business keys; the **Sign-in and OTP** and **Abuse budgets** groups are super
admin only. A permission describes a screen someone is responsible for, and all
of these live on one screen — what actually differs is blast radius. A fee that
is wrong costs money and can be put back; a lockout window that is wrong is an
authentication weakness for as long as nobody notices.

Both tiers are **readable** by anyone holding `settings.manage`. An admin who
cannot see the lockout window cannot explain to a user why they are locked out,
and reading a limit is not what the tier exists to restrict.

Each row arrives with `tier` and `canEdit`. The panel renders what it cannot
save as a locked row with a "Super admin only" badge rather than a live-looking
field that answers 403 — but `canEdit` comes from the server and the server
refuses the write either way. Never infer it from `tier` alone.

Group order is set explicitly, because the server sorts by group name and
alphabetical put `abuse` and `auth` — the two nobody edits day to day — above
the money keys people came to the screen for.

---

## 2026-09-13 — The panel looks like Tabler

Indigo pills on cool neutrals, with a near-black dark mode that read as flat and
heavy. It is Tabler's design language now (tabler.io): its neutral gray ramp,
its blue (`#066fd1`), its geometry — 14px body, 6px controls, 8px cards, 12px
uppercase table headers, and flat surfaces separated by a hairline instead of by
shadow. The numbers in `styles.css` were read off the live template rather than
eyeballed. Dark mode was rebuilt on Tabler's own dark values.

No component changed. Every class name is the same, so the markup and the logic
were untouched — the whole change is one stylesheet.

Two rules keep it coherent, and both are written into the file:

* **`--accent` is a fill, `--accent-text` is ink.** The blue is the same in both
  themes because white-on-blue has to keep working; blue *text* on a dark page
  does not. In light the ink is a step darker than the fill, because the active
  nav item and the links sit on a 10% wash of the blue itself.
* **Every semantic pair needs a dark value, foreground included.** A chip that
  keeps its light-mode ink is how a status column becomes unreadable at night.

Tabler's `#2fb344` / `#f59f00` / `#d63939` are made to be fills — none clears
4.5:1 as 11px text on its own tint — so the ink is darkened while the wash keeps
the hue. Every foreground/background pair clears WCAG AA: worst pair 4.85:1
light, 5.03:1 dark, measured in the browser rather than assumed.
