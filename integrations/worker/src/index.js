const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });

const cors = env => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization"
});

async function authorizeMutation(request, env) {
  if (!env.INTEGRATION_API_TOKEN) {
    return {
      error: "INTEGRATION_API_TOKEN secret is required for mutating API routes",
      status: 503
    };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }

  const providedToken = authorization.slice("Bearer ".length);
  const isAuthorized = await timingSafeEqual(providedToken, env.INTEGRATION_API_TOKEN);
  if (!isAuthorized) return { error: "Unauthorized", status: 401 };

  return null;
}

async function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

async function readConfig(env) {
  if (!env.BUZZ_DATA) return null;
  const raw = await env.BUZZ_DATA.get("integration-config");
  return raw ? JSON.parse(raw) : null;
}

async function writeLog(env, entry) {
  if (!env.BUZZ_DATA) return;
  const key = `sync-log:${Date.now()}`;
  await env.BUZZ_DATA.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
}

async function ncsSearch() {
  throw new Error("NCS adapter is not configured. Add an authorized NCS data source or documented API client.");
}

async function ncsRoster() {
  throw new Error("NCS roster adapter is not configured.");
}

async function ncsEvents() {
  throw new Error("NCS tournament adapter is not configured.");
}

async function gameChangerStats() {
  throw new Error("GameChanger adapter is not configured. Use an authorized export or approved integration.");
}

async function runScheduledSync(env) {
  const config = await readConfig(env);
  if (!config?.sync?.enabled) return { skipped: true, reason: "Synchronization disabled or configuration missing" };
  const result = { startedAt: new Date().toISOString(), events: [], stats: null };
  try {
    if (config.tournamentTeamIds?.length) result.events = await ncsEvents(config.tournamentTeamIds, env);
    if (config.gamechanger?.teamId) result.stats = await gameChangerStats(config.gamechanger, env);
    result.completedAt = new Date().toISOString();
    await writeLog(env, { type: "scheduled-sync", ok: true, ...result });
    return result;
  } catch (error) {
    await writeLog(env, { type: "scheduled-sync", ok: false, error: error.message, at: new Date().toISOString() });
    throw error;
  }
}

export default {
  async fetch(request, env) {
    const headers = cors(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const isPublicGetRequest =
      request.method === "GET" &&
      (
        url.pathname === "/api/health" ||
        url.pathname === "/api/config" ||
        url.pathname === "/api/ncs/teams" ||
        /^\/api\/ncs\/teams\/[^/]+\/roster$/.test(url.pathname)
      );
    const authError = isPublicGetRequest ? null : await authorizeMutation(request, env);
    if (authError) return json({ error: authError.error }, authError.status, headers);

    try {
      if (url.pathname === "/api/health") {
        return json({
          ok: true,
          service: "buzz-elite-integrations",
          adapter: url.searchParams.get("adapter") || "all",
          configured: { kv: !!env.BUZZ_DATA, ncs: false, gamechanger: false },
          timestamp: new Date().toISOString()
        }, 200, headers);
      }

      if (url.pathname === "/api/config" && request.method === "GET") {
        return json(await readConfig(env) || {}, 200, headers);
      }

      if (url.pathname === "/api/config" && request.method === "POST") {
        if (!env.BUZZ_DATA) return json({ error: "BUZZ_DATA KV binding is required" }, 503, headers);
        const config = await request.json();
        await env.BUZZ_DATA.put("integration-config", JSON.stringify(config));
        return json({ ok: true }, 200, headers);
      }

      if (url.pathname === "/api/ncs/teams" && request.method === "GET") {
        return json(await ncsSearch(Object.fromEntries(url.searchParams), env), 200, headers);
      }

      let match = url.pathname.match(/^\/api\/ncs\/teams\/([^/]+)\/roster$/);
      if (match && request.method === "GET") {
        return json(await ncsRoster(decodeURIComponent(match[1]), env), 200, headers);
      }

      if (url.pathname === "/api/ncs/events/sync" && request.method === "POST") {
        const body = await request.json();
        return json(await ncsEvents(body.teamIds || [], env), 200, headers);
      }

      match = url.pathname.match(/^\/api\/ncs\/events\/([^/]+)\/sync$/);
      if (match && request.method === "POST") {
        const events = await ncsEvents([], env, { eventId: decodeURIComponent(match[1]) });
        return json(events[0] || {}, 200, headers);
      }

      if (url.pathname === "/api/gamechanger/sync" && request.method === "POST") {
        const body = await request.json();
        return json(await gameChangerStats(body, env), 200, headers);
      }

      if (url.pathname === "/api/sync/run" && request.method === "POST") {
        return json(await runScheduledSync(env), 200, headers);
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      return json({ error: error.message }, 501, headers);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  }
};
