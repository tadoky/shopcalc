Garage Billing — Prices API (Cloudflare Workers + D1)

This repository contains a simple prototype to host editable pricing for the `index.html` calculator.

What I added:
- `worker/` — Cloudflare Worker source and D1 migration
- `admin.html` — minimal admin page to edit prices (protect this with Cloudflare Access)
- `index.html` — updated to fetch `/api/prices` and fall back to embedded defaults

Quick deploy (Cloudflare Workers + D1)

1. Install Wrangler (Cloudflare CLI) and login:

```bash
npm install -g wrangler
wrangler login
```

2. Create a D1 database in the Cloudflare dashboard and give it the name you will bind in `wrangler.toml` (the example uses `garage_prices`).

3. Update `worker/wrangler.toml` with your `account_id` and D1 binding if necessary.

4. Run migrations to create tables (Wrangler supports D1 migrations):

```bash
wrangler d1 migrations apply --database garage_prices worker/migrations/init.sql
```

5. Set an admin secret (used by `admin.html` and the admin API):

```bash
wrangler secret put ADMIN_SECRET
```

6. Publish the Worker:

```bash
wrangler publish --env production
```

Recommendations:
- Protect `admin.html` with Cloudflare Access (Zero Trust) so only allowed users can open the admin page.
- Configure Access to forward the authenticated user's email as a header (e.g. `X-Admin-Email`) if you want better audit logs.
- Use HTTPS and restrict who can call the admin endpoints.

How `index.html` integrates:
- On load the page fetches `/api/prices`. If that succeeds the live price data replaces the embedded defaults and the parts/extras UI is rebuilt. If the fetch fails, the embedded defaults are used.
