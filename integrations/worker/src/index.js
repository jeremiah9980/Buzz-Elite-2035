const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const cors = (env) => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
});

const NCS_AGE_IDS = Object.freeze({
  "10U": "4",
  "10 & Under": "4",
  "12U": "6",
  "12 & Under": "6",
});

function resolveNcsAgeId(params = {}, env = {}) {
  if (params.ageId) return String(params.ageId);
  if (params.division && NCS_AGE_IDS[params.division]) {
    return NCS_AGE_IDS[params.division];
  }
  return env.NCS_AGE_ID || "4";
}

function buildNcsTeamsUrl(params = {}, env = {}) {
  const base = env.NCS_TEAMS_BASE_URL || "https://playncs.com/fastpitch/Teams";
  const url = new URL(base);
  url.searchParams.set("seasonId", params.seasonId || env.NCS_SEASON_ID || "33");
  url.searchParams.set("country", params.country || env.NCS_COUNTRY || "US");
  url.searchParams.set("state", params.state || env.NCS_STATE || "TX");
  url.searchParams.set("ageId", resolveNcsAgeId(params, env));

  const teamName = params.teamName || params.q;
  if (teamName) url.searchParams.set("teamName", teamName);
  return url.toString();
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
    if (config.tournamentTeamIds?.length) {
      result.events = await ncsEvents(config.tournamentTeamIds, env);
    }
    if (config.gamechanger?.teamId) {
      result.stats = await gameChangerStats(config.gamechanger, env);
    }
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
    const headers = cors(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") {
        return json(
          {
            ok: true,
            service: "buzz-elite-integrations",
            adapter: url.searchParams.get("adapter") || "all",
            configured: {
              kv: !!env.BUZZ_DATA,
              ncs: false,
              gamechanger: false,
            },
            ncs: {
              baseSearchUrl: buildNcsTeamsUrl({}, env),
              seasonId: env.NCS_SEASON_ID || "33",
              country: env.NCS_COUNTRY || "US",
              state: env.NCS_STATE || "TX",
              defaultAgeId: env.NCS_AGE_ID || "4",
              ageMappings: NCS_AGE_IDS,
              teamNameParameter: "teamName",
            },
            timestamp: new Date().toISOString(),
          },
          200,
          headers
        );
      }

      if (url.pathname === "/api/config" && request.method === "GET") {
        return json((await readConfig(env)) || {}, 200, headers);
      }

      if (url.pathname === "/api/config" && request.method === "POST") {
        if (!env.BUZZ_DATA) {
          return json({ error: "BUZZ_DATA KV binding is required" }, 503, headers);
        }
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
        return json(await gameChangerStats(await request.json(), env), 200, headers);
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
  },
};
