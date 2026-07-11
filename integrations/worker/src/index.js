const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const WRITE_PATHS = new Set([
  "/api/config",
  "/api/ncs/events/sync",
  "/api/gamechanger/sync",
  "/api/sync/run",
]);
const EXPENSIVE_PATH_PREFIXES = [
  "/api/ncs/teams",
  "/api/ncs/events",
  "/api/gamechanger/sync",
  "/api/sync/run",
];

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...JSON_HEADERS,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      ...headers,
    },
  });

const cors = (request, env) => {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_ORIGIN || "https://jeremiah9980.github.io";
  const headers = {
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
  if (origin === allowed) headers["access-control-allow-origin"] = allowed;
  return headers;
};

const NCS_AGE_IDS = Object.freeze({
  "10U": "4",
  "10 & Under": "4",
  "12U": "6",
  "12 & Under": "6",
});

function resolveNcsAgeId(params = {}) {
  if (params.ageId) return String(params.ageId);
  if (params.division && NCS_AGE_IDS[params.division]) return NCS_AGE_IDS[params.division];
  return "";
}

function buildNcsTeamsUrl(params = {}, env = {}) {
  const base = env.NCS_TEAMS_BASE_URL || "https://playncs.com/fastpitch/Teams";
  const url = new URL(base);
  url.searchParams.set("seasonId", params.seasonId || env.NCS_SEASON_ID || "33");
  url.searchParams.set("country", params.country || env.NCS_COUNTRY || "US");
  url.searchParams.set("state", params.state || env.NCS_STATE || "TX");
  const ageId = resolveNcsAgeId(params);
  if (ageId) url.searchParams.set("ageId", ageId);
  const teamName = params.teamName || params.q;
  if (teamName) url.searchParams.set("teamName", teamName);
  return url.toString();
}

function clientKey(request, pathname) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return `${ip}:${pathname}`;
}

function isExpensivePath(pathname) {
  return EXPENSIVE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function enforceRateLimit(request, env, pathname) {
  const key = clientKey(request, pathname);
  const publicResult = await env.PUBLIC_API_LIMITER?.limit({ key });
  if (publicResult && !publicResult.success) return false;
  if (isExpensivePath(pathname)) {
    const expensiveResult = await env.EXPENSIVE_API_LIMITER?.limit({ key });
    if (expensiveResult && !expensiveResult.success) return false;
  }
  return true;
}

function isAuthorized(request, env) {
  if (!env.API_ADMIN_TOKEN) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${env.API_ADMIN_TOKEN}`;
}

function isWriteRequest(pathname, method) {
  if (method !== "POST") return false;
  if (WRITE_PATHS.has(pathname)) return true;
  return /^\/api\/ncs\/events\/[^/]+\/sync$/.test(pathname);
}

async function readJson(request, env) {
  const maxBytes = Number(env.MAX_REQUEST_BYTES || 32768);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw Object.assign(new Error("Request body too large"), { status: 413 });
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Content-Type must be application/json"), { status: 415 });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw Object.assign(new Error("Request body too large"), { status: 413 });
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}

async function readConfig(env) {
  if (!env.BUZZ_DATA) return null;
  const raw = await env.BUZZ_DATA.get("integration-config");
  return raw ? JSON.parse(raw) : null;
}

async function writeLog(env, entry) {
  if (!env.BUZZ_DATA) return;
  await env.BUZZ_DATA.put(`sync-log:${Date.now()}`, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
}

async function ncsSearch(params, env) {
  const sourceUrl = buildNcsTeamsUrl(params, env);
  throw new Error(`NCS adapter is not configured yet. Base search URL: ${sourceUrl}`);
}

async function ncsRoster() {
  throw new Error("NCS roster adapter is not configured.");
}

async function ncsEvents() {
  throw new Error("NCS tournament adapter is not configured.");
}

async function gameChangerStats() {
  throw new Error(
    "GameChanger adapter is not configured. Use an authorized export or approved integration."
  );
}

async function runScheduledSync(env) {
  const config = await readConfig(env);
  if (!config?.sync?.enabled) {
    return { skipped: true, reason: "Synchronization disabled or configuration missing" };
  }
  const result = { startedAt: new Date().toISOString(), events: [], stats: null };
  try {
    if (config.tournamentTeamIds?.length) result.events = await ncsEvents(config.tournamentTeamIds, env);
    if (config.gamechanger?.teamId) result.stats = await gameChangerStats(config.gamechanger, env);
    result.completedAt = new Date().toISOString();
    await writeLog(env, { type: "scheduled-sync", ok: true, ...result });
    return result;
  } catch (error) {
    await writeLog(env, {
      type: "scheduled-sync",
      ok: false,
      error: error.message,
      at: new Date().toISOString(),
    });
    throw error;
  }
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin");
      if (origin !== (env.ALLOWED_ORIGIN || "https://jeremiah9980.github.io")) {
        return new Response(null, { status: 403, headers });
      }
      return new Response(null, { status: 204, headers });
    }

    if (!pathname.startsWith("/api/")) return json({ error: "Not found" }, 404, headers);
    if (!["GET", "POST"].includes(request.method)) {
      return json({ error: "Method not allowed" }, 405, { ...headers, allow: "GET, POST, OPTIONS" });
    }

    if (!(await enforceRateLimit(request, env, pathname))) {
      return json(
        { error: "Rate limit exceeded", retryAfterSeconds: 60 },
        429,
        { ...headers, "retry-after": "60" }
      );
    }

    if (isWriteRequest(pathname, request.method) && !isAuthorized(request, env)) {
      return json({ error: "Unauthorized" }, 401, {
        ...headers,
        "www-authenticate": 'Bearer realm="buzz-integrations"',
      });
    }

    try {
      if (pathname === "/api/health") {
        return json(
          {
            ok: true,
            service: "buzz-elite-integrations",
            configured: {
              kv: !!env.BUZZ_DATA,
              ncs: false,
              gamechanger: false,
              adminToken: !!env.API_ADMIN_TOKEN,
              rateLimiting: !!env.PUBLIC_API_LIMITER && !!env.EXPENSIVE_API_LIMITER,
            },
            ncs: {
              baseSearchUrl: buildNcsTeamsUrl({}, env),
              seasonId: env.NCS_SEASON_ID || "33",
              country: env.NCS_COUNTRY || "US",
              state: env.NCS_STATE || "TX",
              defaultAge: "any",
              ageMappings: NCS_AGE_IDS,
              teamNameParameter: "teamName",
            },
            timestamp: new Date().toISOString(),
          },
          200,
          headers
        );
      }

      if (pathname === "/api/config" && request.method === "GET") {
        return json((await readConfig(env)) || {}, 200, headers);
      }

      if (pathname === "/api/config" && request.method === "POST") {
        if (!env.BUZZ_DATA) return json({ error: "BUZZ_DATA KV binding is required" }, 503, headers);
        const config = await readJson(request, env);
        await env.BUZZ_DATA.put("integration-config", JSON.stringify(config));
        return json({ ok: true }, 200, headers);
      }

      if (pathname === "/api/ncs/teams" && request.method === "GET") {
        return json(await ncsSearch(Object.fromEntries(url.searchParams), env), 200, headers);
      }

      let match = pathname.match(/^\/api\/ncs\/teams\/([^/]+)\/roster$/);
      if (match && request.method === "GET") {
        return json(await ncsRoster(decodeURIComponent(match[1]), env), 200, headers);
      }

      if (pathname === "/api/ncs/events/sync" && request.method === "POST") {
        const body = await readJson(request, env);
        return json(await ncsEvents(body.teamIds || [], env), 200, headers);
      }

      match = pathname.match(/^\/api\/ncs\/events\/([^/]+)\/sync$/);
      if (match && request.method === "POST") {
        const events = await ncsEvents([], env, { eventId: decodeURIComponent(match[1]) });
        return json(events[0] || {}, 200, headers);
      }

      if (pathname === "/api/gamechanger/sync" && request.method === "POST") {
        return json(await gameChangerStats(await readJson(request, env), env), 200, headers);
      }

      if (pathname === "/api/sync/run" && request.method === "POST") {
        return json(await runScheduledSync(env), 200, headers);
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const status = Number(error.status || 501);
      return json({ error: error.message }, status, headers);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  },
};
