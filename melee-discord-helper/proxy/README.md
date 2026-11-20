# Melee.gg CORS proxy

The Melee.gg API does not send CORS headers, so the browser page cannot call it
directly. This Cloudflare Worker forwards the four read-only endpoints the page
uses and adds CORS headers for `https://acasaccia.github.io` (and `localhost`
for development).

The worker stores no secrets and does not log anything. The user's Melee.gg
credentials are entered in the web page and passed through in the
`Authorization` header. Workers Logs are explicitly disabled in
`wrangler.toml` (`[observability] enabled = false`), so nothing is retained by
Cloudflare regardless of the account defaults.

## Deploy

Use a scoped API token instead of `wrangler login`, which grants a much broader
set of OAuth scopes than this worker needs.

### 1. Create a minimal API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create
Custom Token**:

- **Permissions**: `Account` → `Workers Scripts` → `Edit` (nothing else)
- **Account Resources**: Include → your account only (not "All accounts")
- **Client IP Address Filtering** (optional): the public IP of the machine you
  run `wrangler deploy` from (it restricts who can use the token, not who can
  call the worker)
- **TTL**: a short expiry, or revoke the token after deploying

The worker has no bindings (KV, D1, R2, secrets) and is served on
`*.workers.dev`, so no other permission is required. If the account has no
`workers.dev` subdomain yet, create it once from the dashboard
(**Workers & Pages**) rather than granting the token extra permissions.

### 2. Deploy

```bash
cd melee-discord-helper/proxy
export CLOUDFLARE_API_TOKEN=...   # the token created above
export CLOUDFLARE_ACCOUNT_ID=...  # dashboard sidebar → "Account ID"
npx wrangler deploy
```

Setting `CLOUDFLARE_ACCOUNT_ID` avoids the account lookup, which would
otherwise require the extra `User → Memberships → Read` permission.

Wrangler prints the worker URL (e.g. `https://melee-proxy.<account>.workers.dev`).
Set it as `PROXY_URL` in `../app.js`.

After the first deploy, check in the dashboard (worker → **Settings →
Observability**) that Workers Logs are off.

Alternatively, create a Worker from the Cloudflare dashboard and paste the
contents of `worker.js` into the editor (in that case disable Workers Logs
manually in the worker settings).
