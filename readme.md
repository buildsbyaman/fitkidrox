# FITKIDROX by PSSS

**Young Minds. Stronger Bodies. Brighter Futures.**

The website for FITKIDROX, a school-focused kids' fitness race inspired by the HYROX format. The inaugural flagship event is planned for 28–29 November 2026 at the Sector 10D Skating Rink, Chandigarh (venue to be confirmed), with four age-based categories from 3 to 13+ years.

## What's live

- **Home (`/`)**: event overview with countdown, the four categories with an age finder, safety commitments, calls to action for schools, sponsors and parents, a road-to-race-day timeline and FAQ.
- **Register interest (`/register`)**: three-step parent pre-registration. The category is picked automatically from date of birth, and the form collects consent.
- **Schools (`/schools`)**: bulk entry with an editable student roster, per-category counts and an estimated total.
- **Sponsors (`/sponsors`)**: sponsorship packages and an enquiry form.

Forms submit to the API in [`server/`](server) and are saved to MongoDB Atlas (`src/data/api.ts` is the browser client). Event content is in `src/data/fixtures.ts`.

## Tech

TanStack Start (React 19, TanStack Router), Vite, Tailwind CSS 4 and shadcn/ui components, with an Express + Mongoose API backed by MongoDB Atlas.

## Run locally

```bash
pnpm install
npm --prefix server install

# once: put your Atlas password in server/.env
cp server/.env.example server/.env

pnpm dev:server   # API on http://localhost:4000
pnpm dev          # site on http://localhost:3000, proxies /api to the API
```

### API

| Method | Path                     | Purpose                               |
| ------ | ------------------------ | ------------------------------------- |
| `GET`  | `/api/health`            | connection check                      |
| `POST` | `/api/participants`      | parent pre-registration               |
| `POST` | `/api/schools`           | school bulk entry with roster         |
| `POST` | `/api/sponsors`          | sponsor enquiry                       |
| `POST` | `/api/admin/login`       | sets an httpOnly session cookie       |
| `POST` | `/api/admin/logout`      | clears the session                    |
| `GET`  | `/api/admin/me`          | `{ ok: true }` when signed in         |
| `GET`  | `/api/admin/:collection` | newest-first listing, needs a session |

Each submission `POST` answers `{ "reference": "FKX-26-48213" }`. Collections are `participants`, `schools` and `sponsors`.

### Admin panel

`/admin` is a hidden route (not linked in the nav) with a login screen and a
read-only dashboard for the three collections, with search, sorting and CSV
export.

Sign-in uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server/.env` — set both,
or every login answers `503`. Sessions live in process memory, so a restart
signs you out; the cookie expires after 8 hours. Login is rate-limited to 5
attempts per IP per 15 minutes.

Your Atlas user needs read/write on the `fitkidrox` database, and your public IP must be in the cluster's network access allowlist (or `0.0.0.0/0` while developing).

## Roadmap

Next up: UPI/card payments, event-day check-in, and results and certificates.
