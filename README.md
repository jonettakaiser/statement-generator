# Statement Generator

Upload platform revenue CSVs, assign per-program revenue splits, and generate
draft production-company statements for review, PDF export, and publishing.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (custom components, no external UI library)
- Supabase (Postgres + Auth)

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create a Supabase project, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the Supabase SQL editor to create the tables, indexes, and RLS policies.

3. Copy the env template and fill in your project's API settings
   (Project Settings → API):

   ```
   cp .env.local.example .env.local
   ```

4. Create at least one admin user: sign a user up via Supabase Auth, then
   insert a matching row in `users` with `role = 'admin'`:

   ```sql
   insert into users (auth_user_id, email, role)
   values ('<auth-user-uuid>', 'you@example.com', 'admin');
   ```

5. Add production companies and films (`production_companies`, `films`) so
   uploaded CSV rows have something to match against.

6. Run the app:

   ```
   npm run dev
   ```

## Workflow

1. **Upload** a platform CSV (`Program Name, Episode, Gross Earned,
   Impressions, ECPM`) with a platform name and revenue period.
2. **Assign splits** — match each row to a library title, mark it
   Feature/Series, and choose a client/distributor split. Auto-match fills in
   rows whose CSV name matches a title or a previously saved default; "Save
   default" remembers a program's split for future uploads.
3. **Generate** — pick a payment month, select ready rows (grouped by
   production company), and generate a draft statement. Rows spanning
   multiple companies produce one statement per company.
4. **Review, print, and publish** — preview the statement, print/save as PDF,
   and publish it to the production company's "My Statements" view. Publishing
   can optionally send a notification email (currently logged to the server
   console — wire up a real provider such as Resend or SES in
   `src/app/api/statements/[id]/send/route.ts` before relying on it).

## Notes

- API routes use the Supabase **service role** key server-side and enforce
  `role = 'admin'` via `requireAdmin()` in `src/lib/supabase-server.ts`. Never
  expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- `npm audit` flags advisories against `next@14.x` that are only exploitable
  via features this app doesn't use (custom servers, i18n rewrites,
  Middleware proxying). Next 16 fixes them but is a breaking upgrade
  (async route params, etc.) — evaluate separately before taking it.
