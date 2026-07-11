# Public API Security: Rate Limiting and WAF

The Worker now enforces application-level protection before provider adapters run:

- `PUBLIC_API_LIMITER`: 120 requests per minute per client IP and route.
- `EXPENSIVE_API_LIMITER`: 10 requests per minute per client IP and expensive route.
- Bearer authentication for configuration writes and manual sync operations.
- 32 KB request-body limit.
- JSON-only POST bodies.
- Exact-origin CORS for `https://jeremiah9980.github.io`.
- Method allowlist: `GET`, `POST`, and `OPTIONS` only.
- Security headers and `Cache-Control: no-store` on API responses.

## 1. Set the administrative API token

From `integrations/worker/`:

```bash
npx wrangler secret put API_ADMIN_TOKEN
```

Use a long random value. Do not commit it to GitHub.

The protected routes require:

```http
Authorization: Bearer <API_ADMIN_TOKEN>
```

Protected operations:

- `POST /api/config`
- `POST /api/ncs/events/sync`
- `POST /api/ncs/events/:eventId/sync`
- `POST /api/gamechanger/sync`
- `POST /api/sync/run`

## 2. Deploy the Worker rate limiting bindings

Cloudflare Workers Rate Limiting bindings require Wrangler 4.36.0 or later.

```bash
npx wrangler@latest deploy
```

The namespaces in `wrangler.toml` are account-unique integers. If Cloudflare reports a namespace collision, replace `10401` and `10402` with two unused integer identifiers and deploy again.

## 3. Put the Worker on a custom API hostname

Use a hostname in a Cloudflare-managed zone, for example:

```text
api.yourdomain.com
```

WAF custom rules and zone-level rate limiting rules are applied to traffic through the Cloudflare zone. Add the Worker as a Custom Domain or route before creating the WAF rules.

## 4. Recommended WAF custom rules

In Cloudflare Dashboard, select the API domain, then go to **Security rules → Create rule → Custom rules**.

Replace `api.yourdomain.com` in the expressions below.

### Block unexpected methods

Expression:

```text
(http.host eq "api.yourdomain.com" and starts_with(http.request.uri.path, "/api/") and not http.request.method in {"GET" "POST" "OPTIONS"})
```

Action: **Block**

### Block oversized declared request bodies

Expression:

```text
(http.host eq "api.yourdomain.com" and starts_with(http.request.uri.path, "/api/") and http.request.body.size gt 32768)
```

Action: **Block**

Keep the Worker-side limit as the final enforcement layer because some requests may not include a reliable declared body size.

### Block POST requests without JSON content type

Expression:

```text
(http.host eq "api.yourdomain.com" and starts_with(http.request.uri.path, "/api/") and http.request.method eq "POST" and not lower(http.request.headers["content-type"][0]) contains "application/json")
```

Action: **Block**

### Challenge obvious automated abuse

Expression:

```text
(http.host eq "api.yourdomain.com" and starts_with(http.request.uri.path, "/api/") and cf.client.bot and not http.request.uri.path eq "/api/health")
```

Action: **Managed Challenge**

Review Security Events before making bot rules stricter, because legitimate monitoring and integration clients may be automated.

## 5. Recommended zone-level rate limiting rules

Create these under **Security rules → Rate limiting rules**.

### Public API burst protection

Match expression:

```text
(http.host eq "api.yourdomain.com" and starts_with(http.request.uri.path, "/api/"))
```

Counting characteristic: **IP**

Suggested threshold:

```text
120 requests per 60 seconds
```

Mitigation timeout:

```text
60 seconds
```

Action: **Block** or **Managed Challenge**

### Expensive integration routes

Match expression:

```text
(http.host eq "api.yourdomain.com" and (
  starts_with(http.request.uri.path, "/api/ncs/") or
  starts_with(http.request.uri.path, "/api/gamechanger/") or
  http.request.uri.path eq "/api/sync/run"
))
```

Counting characteristic: **IP**

Suggested threshold:

```text
10 requests per 60 seconds
```

Mitigation timeout:

```text
120 seconds
```

Action: **Block**

The Worker bindings remain useful even with WAF rate limiting because they can apply route-specific logic after the Worker starts. WAF rules reduce abusive traffic before it reaches application logic.

## 6. Validation commands

Set these first:

```bash
export API_BASE_URL="https://api.yourdomain.com"
export API_ADMIN_TOKEN="your-secret-token"
```

Health check:

```bash
curl -i "$API_BASE_URL/api/health"
```

Unauthorized write should return `401`:

```bash
curl -i -X POST "$API_BASE_URL/api/config" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

Authorized write:

```bash
curl -i -X POST "$API_BASE_URL/api/config" \
  -H "Authorization: Bearer $API_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"sync":{"enabled":false}}'
```

Wrong content type should return `415`:

```bash
curl -i -X POST "$API_BASE_URL/api/config" \
  -H "Authorization: Bearer $API_ADMIN_TOKEN" \
  -H 'Content-Type: text/plain' \
  --data '{}'
```

Unsupported method should return `405`:

```bash
curl -i -X DELETE "$API_BASE_URL/api/config"
```

Generate a short rate-limit test burst:

```bash
for i in $(seq 1 130); do
  curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/api/health"
done
```

Expect `429` responses after the configured threshold. Cloudflare rate limiting is distributed and designed for abuse mitigation, so tests may not behave like a strict centralized counter at every edge location.

## 7. Monitoring

After deployment, review:

- Cloudflare **Security Events** for WAF matches.
- Worker logs for `401`, `413`, `415`, and `429` responses.
- Rate limiting analytics for route and client-IP patterns.
- Legitimate CMS traffic before lowering thresholds.

Start with the documented thresholds, observe normal usage for several days, and tighten only where the traffic data supports it.
