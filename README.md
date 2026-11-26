# Trend API (Cloudflare Worker)

Backend for the Trend platform. Open `/docs` on the deployed Worker to see and test every route.

## Connect GitHub to Cloudflare (one-time setup)

1. **Create the database.** Cloudflare dashboard > Storage & Databases > D1 > Create database, name it `trend-db`.
   Copy its **Database ID** and paste it into `wrangler.toml` (replace `REPLACE_WITH_ID_FROM_wrangler_d1_create`). Commit.
2. **Create the tables.** Open the `trend-db` database > Console, paste the contents of `schema.sql`, and run it.
3. **Create the file bucket.** R2 > Create bucket, name it `trend-uploads`.
4. **Connect the repo.** Workers & Pages > Create > Import a repository > pick this repo.
   Build command: leave empty. Deploy command: `npx wrangler deploy`.
5. **Add secrets.** Worker > Settings > Variables and Secrets > add as *Secret*:
   `JWT_SECRET` (long random string), `TERMII_API_KEY`, `BREVO_API_KEY`.
6. Visit `https://<worker-name>.<your-subdomain>.workers.dev/docs`.

## Before going live
- In `wrangler.toml` set `ENVIRONMENT = "prod"` (stops OTP codes appearing in responses), and update `BANK_DETAILS`, `BREVO_SENDER`, `COMMISSION_PCT`.
- Make an admin: register normally, then run in the D1 console:
  `UPDATE users SET role='admin' WHERE email='you@example.com';`

## Local dev
`npm install && npx wrangler d1 execute trend-db --local --file=schema.sql && npx wrangler dev`
Put local secrets in `.dev.vars` (not committed): `JWT_SECRET=...`
