/**
 * Buzz Elite Integrations Worker — live NCS (playncs.com) adapter.
 *
 * playncs.com is a server-rendered ASP.NET site with no JSON API and no CORS
 * headers, so the static CMS cannot call it from the browser. This Worker
 * fetches the public NCS pages server-side, parses the HTML, and returns JSON
 * with CORS enabled.
 *
 * Public read/scrape routes (used by cms/integrations.html):
 *   GET  /api/health?adapter=health|ncs|gamechanger
 *   GET  /api/ncs/teams?q=&division=&state=&country=&seasonId=&city=
 *   GET  /api/ncs/teams/:id/roster        (:id also accepts a pasted team URL)
 *   POST /api/ncs/events/sync             {teamIds: []}
 *   POST /api/ncs/events/:id/sync
 *   POST /api/gamechanger/sync            -> 501 (GameChanger has no public API)
 *
 * Token-protected admin routes (Authorization: Bearer <INTEGRATION_API_TOKEN>):
 *   GET/POST /api/config                  (requires BUZZ_DATA KV binding)
 *   POST     /api/sync/run
 */

const NCS_BASE = "https://playncs.com";
const UA = "Mozilla/5.0 (compatible; BuzzEliteIntegrations/2.0; +https://jeremiah9980.github.io/Buzz-Elite-2035/)";

// playncs age-division select values (from the Teams search form).
const AGE_IDS = { "6u": "13", "8u": "2", "9u": "3", "10u": "4", "12u": "6", "14u": "8", "16u": "10", "18u": "12", "adult": "17" };

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });

const cors = env => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization"
});

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function readJson(request) {
  try { return await request.json(); }
  catch (error) { throw error instanceof SyntaxError ? httpError(400, "Invalid JSON body") : error; }
}

/* ---------------- auth (admin routes only) ---------------- */

async function authorizeMutation(request, env) {
  if (!env.INTEGRATION_API_TOKEN) {
    return { error: "INTEGRATION_API_TOKEN secret is required for admin API routes", status: 503 };
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };
  const isAuthorized = await timingSafeEqual(authorization.slice("Bearer ".length), env.INTEGRATION_API_TOKEN);
  if (!isAuthorized) return { error: "Unauthorized", status: 401 };
  return null;
}

async function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) mismatch |= leftBytes[index] ^ rightBytes[index];
  return mismatch === 0;
}

/* ---------------- KV config + logs ---------------- */

async function readConfig(env) {
  if (!env.BUZZ_DATA) return null;
  const raw = await env.BUZZ_DATA.get("integration-config");
  return raw ? JSON.parse(raw) : null;
}

async function writeLog(env, entry) {
  if (!env.BUZZ_DATA) return;
  await env.BUZZ_DATA.put(`sync-log:${Date.now()}`, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
}

/* ---------------- NCS fetching + parsing ---------------- */

async function fetchNcs(path) {
  const res = await fetch(NCS_BASE + path, { headers: { "User-Agent": UA, "Accept": "text/html" } });
  if (!res.ok) throw httpError(502, `NCS returned HTTP ${res.status} for ${path}`);
  return res.text();
}

const decode = s =>
  String(s ?? "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

/** Numeric team/event id from a raw id, or a pasted playncs URL. */
function extractId(raw) {
  const s = String(raw ?? "").trim();
  const url = s.match(/Details\/(\d+)/i);
  if (url) return url[1];
  return /^\d+$/.test(s) ? s : null;
}

function parseTeamSearch(html) {
  const teams = [];
  const rowRe = /<tr>\s*<td>\s*<a href="\/fastpitch\/Teams\/Details\/(\d+)\/([^"]*)">\s*([^<]+)<\/a>[\s\S]*?<\/td>\s*<td>\s*([^<]*?)\s*<\/td>\s*<td class="hidden-xs">\s*([^<]*?)\s*<\/td>\s*<td class="text-nowrap">\s*([^<]*?)\s*<\/td>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    teams.push({
      id: m[1],
      slug: m[2],
      name: decode(m[3]),
      division: decode(m[4]),
      location: decode(m[5]),
      record: decode(m[6]),
      url: `${NCS_BASE}/fastpitch/Teams/Details/${m[1]}/${m[2]}`
    });
  }
  return teams;
}

function sliceSection(html, panelId) {
  const start = html.indexOf(`id="${panelId}"`);
  if (start < 0) return "";
  const end = html.indexOf('class="panel"', start + 10);
  return html.slice(start, end < 0 ? undefined : end);
}

function parseRoster(html) {
  const section = sliceSection(html, "collapse-roster");
  const players = [];
  const rowRe = /<tr>\s*<td>\s*([^<]*?)\s*<\/td>\s*<td>\s*<a href="\/fastpitch\/Players\/Details\/(\d+)\/([^"]*)">\s*([^<]+)<\/a>/g;
  let m;
  while ((m = rowRe.exec(section))) {
    players.push({
      id: m[2],
      number: decode(m[1]),
      name: decode(m[4]),
      position: "",
      url: `${NCS_BASE}/fastpitch/Players/Details/${m[2]}/${m[3]}`
    });
  }
  return players;
}

function parseTitle(html) {
  const m = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/) || html.match(/<title>\s*([^<|]+)/);
  return m ? decode(m[1]) : "";
}

function parseEvents(html) {
  const section = sliceSection(html, "collapse-events") || html;
  const events = [];
  const blockRe = /<div class="media\s*"[\s\S]*?(?=<div class="media\s*"|$)/g;
  let b;
  while ((b = blockRe.exec(section))) {
    const block = b[0];
    const link = block.match(/href="\/fastpitch\/Events\/Details\/(\d+)\/([^"]*)"/);
    if (!link || events.some(e => e.id === link[1])) continue;
    const nameM = block.match(/<div class="h4">\s*<a href="\/fastpitch\/Events\/Details\/[^"]*">\s*([\s\S]*?)\s*<\/a>/);
    const dateM = block.match(/<div class="h4">\s*([A-Z][a-z]{2}\s[\s\S]*?)\s*<\/div>/);
    const locM = block.match(/<div class="h6">\s*<span>\s*([^<]+?)\s*<\/span>/);
    const typeM = block.match(/<div class="h5 stature">\s*([^<]+?)\s*<\/div>/);
    events.push({
      id: link[1],
      name: decode(nameM ? nameM[1] : link[2].replace(/-/g, " ")),
      startDate: decode(dateM ? dateM[1] : ""),
      location: decode(locM ? locM[1] : ""),
      status: decode(typeM ? typeM[1] : "Registered"),
      url: `${NCS_BASE}/fastpitch/Events/Details/${link[1]}/${link[2]}`
    });
  }
  return events;
}

/* ---------------- adapters ---------------- */

async function ncsSearch(params, env) {
  const q = new URLSearchParams();
  q.set("seasonId", params.seasonId || env.NCS_SEASON_ID || "33");
  q.set("country", params.country || env.NCS_COUNTRY || "US");
  q.set("state", params.state || env.NCS_STATE || "");
  q.set("usState", params.state || env.NCS_STATE || "");
  if (params.q) q.set("teamName", params.q);
  if (params.city) q.set("city", params.city);
  const division = String(params.division || "").toLowerCase().replace(/[^0-9a-z]/g, "");
  if (AGE_IDS[division]) q.set("ageId", AGE_IDS[division]);
  const html = await fetchNcs(`/fastpitch/Teams?${q}`);
  return parseTeamSearch(html);
}

async function ncsRoster(rawId) {
  const teamId = extractId(rawId);
  if (!teamId) throw httpError(400, "Invalid NCS team id");
  const html = await fetchNcs(`/fastpitch/Teams/Details/${teamId}/team`);
  const roster = parseRoster(html);
  if (!roster.length && /no players currently on the roster/i.test(html)) {
    throw httpError(404, `NCS lists no players on the ${parseTitle(html) || "team"} roster yet.`);
  }
  return roster;
}

async function ncsEvents(teamIds, env, options = {}) {
  if (options.eventId) {
    const eventId = extractId(options.eventId);
    if (!eventId) throw httpError(400, "Invalid NCS event id");
    const html = await fetchNcs(`/fastpitch/Events/Details/${eventId}/event`);
    const dateM = html.match(/<div class="h4">\s*([A-Z][a-z]{2}\s[^<]*?)\s*<\/div>/);
    const locM = html.match(/<div class="h6">\s*<span>\s*([^<]+?)\s*<\/span>/);
    const games = [];
    const gameRe = /<a href="\/fastpitch\/Games\/Details\/(\d+)[^"]*"/g;
    let g;
    while ((g = gameRe.exec(html))) if (!games.some(x => x.id === g[1])) games.push({ id: g[1] });
    return [{
      id: eventId,
      name: parseTitle(html),
      startDate: decode(dateM ? dateM[1] : ""),
      location: decode(locM ? locM[1] : ""),
      status: "Registered",
      games,
      url: `${NCS_BASE}/fastpitch/Events/Details/${eventId}/event`,
      lastSyncedAt: new Date().toISOString()
    }];
  }
  const ids = (teamIds || []).map(extractId).filter(Boolean);
  if (!ids.length) throw httpError(400, "No valid NCS team IDs or URLs provided.");
  const merged = [];
  for (const id of ids) {
    const html = await fetchNcs(`/fastpitch/Teams/Details/${id}/team`);
    for (const e of parseEvents(html)) {
      if (!merged.some(x => x.id === e.id)) merged.push({ ...e, teamId: id, lastSyncedAt: new Date().toISOString() });
    }
  }
  return merged;
}

/* ---------------- gc_stats D1 cross-reference ---------------- */

const normName = s => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Load the whole cross-reference set (small tables) in one round trip each. */
async function loadGcStats(env) {
  if (!env.GC_STATS) {
    throw httpError(503, "GameChanger has no public API and the GC_STATS D1 binding is missing; stats sync is unavailable. Record GameChanger player IDs manually in Roster Mapping.");
  }
  const [players, totals, teams] = await Promise.all([
    env.GC_STATS.prepare("SELECT player_id, name, roster_team FROM players").all(),
    env.GC_STATS.prepare("SELECT player_id, gc_url, season, section, games, stats, updated_at FROM season_totals").all(),
    env.GC_STATS.prepare("SELECT gc_url, gc_name, season, ncs_teams FROM teams").all()
  ]);
  const statsByPlayer = {};
  for (const row of totals.results) {
    const bucket = (statsByPlayer[row.player_id] ??= { gcUrl: row.gc_url, season: row.season, updatedAt: row.updated_at, sections: {} });
    try { bucket.sections[row.section] = { games: row.games, ...JSON.parse(row.stats) }; } catch (e) { /* skip bad row */ }
  }
  return { players: players.results, statsByPlayer, teams: teams.results };
}

/**
 * Match one website player against gc_stats players.
 * Confidence: "exact" (NCS id), "name" (full normalized name), "partial" (last name + first initial).
 */
function matchPlayer(sitePlayer, gcPlayers) {
  if (sitePlayer.ncsPlayerId) {
    const hit = gcPlayers.find(p => p.player_id === String(sitePlayer.ncsPlayerId));
    if (hit) return { ...hit, confidence: "exact" };
  }
  const n = normName(sitePlayer.name);
  if (!n) return null;
  const full = gcPlayers.filter(p => normName(p.name) === n);
  if (full.length === 1) return { ...full[0], confidence: "name" };
  const parts = n.split(" ");
  const last = parts[parts.length - 1], firstInitial = parts[0]?.[0];
  const partial = gcPlayers.filter(p => {
    const gp = normName(p.name).split(" ");
    return gp[gp.length - 1] === last && gp[0]?.[0] === firstInitial;
  });
  if (partial.length === 1) return { ...partial[0], confidence: "partial" };
  return null;
}

async function gameChangerStats(body, env) {
  const sitePlayers = body?.players || [];
  const { players: gcPlayers, statsByPlayer, teams } = await loadGcStats(env);
  const stats = {};
  const matches = [];
  for (const sp of sitePlayers) {
    const hit = matchPlayer(sp, gcPlayers);
    if (hit && statsByPlayer[hit.player_id]) stats[hit.player_id] = statsByPlayer[hit.player_id];
    matches.push({
      playerId: sp.id ?? null,
      name: sp.name ?? "",
      matched: !!hit,
      matchedNcsPlayerId: hit ? hit.player_id : "",
      confidence: hit ? hit.confidence : "none",
      rosterTeam: hit ? hit.roster_team : "",
      hasStats: !!(hit && statsByPlayer[hit.player_id])
    });
  }
  return { ok: true, source: "gc_stats", teams, matches, stats };
}

async function runScheduledSync(env) {
  const config = await readConfig(env);
  if (!config?.sync?.enabled) return { skipped: true, reason: "Synchronization disabled or configuration missing" };
  const result = { startedAt: new Date().toISOString(), events: [], stats: null };
  try {
    if (config.tournamentTeamIds?.length) result.events = await ncsEvents(config.tournamentTeamIds, env);
    result.completedAt = new Date().toISOString();
    await writeLog(env, { type: "scheduled-sync", ok: true, ...result });
    return result;
  } catch (error) {
    await writeLog(env, { type: "scheduled-sync", ok: false, error: error.message, at: new Date().toISOString() });
    throw error;
  }
}

/* ---------------- router ---------------- */

export default {
  async fetch(request, env) {
    const headers = cors(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        const adapter = url.searchParams.get("adapter") || "all";
        return json({
          ok: adapter === "gamechanger" ? !!env.GC_STATS : true,
          service: "buzz-elite-integrations",
          adapter,
          configured: { kv: !!env.BUZZ_DATA, ncs: true, gamechanger: !!env.GC_STATS },
          detail: adapter === "gamechanger"
            ? (env.GC_STATS
                ? "GameChanger adapter backed by the gc_stats D1 database (keyed by NCS player id)."
                : "GameChanger has no public API and GC_STATS is not bound; map player IDs manually in Roster Mapping.")
            : adapter === "ncs" ? `NCS adapter live (scraping ${NCS_BASE})` : "Integration API reachable",
          timestamp: new Date().toISOString()
        }, 200, headers);
      }

      // Admin routes: token required.
      if (url.pathname === "/api/config" || url.pathname === "/api/sync/run") {
        const authError = await authorizeMutation(request, env);
        if (authError) return json({ error: authError.error }, authError.status, headers);
        if (url.pathname === "/api/config" && request.method === "GET") return json(await readConfig(env) || {}, 200, headers);
        if (url.pathname === "/api/config" && request.method === "POST") {
          if (!env.BUZZ_DATA) return json({ error: "BUZZ_DATA KV binding is required" }, 503, headers);
          await env.BUZZ_DATA.put("integration-config", JSON.stringify(await readJson(request)));
          return json({ ok: true }, 200, headers);
        }
        if (url.pathname === "/api/sync/run" && request.method === "POST") return json(await runScheduledSync(env), 200, headers);
      }

      // Public NCS routes (read-only scrapes of public pages).
      if (url.pathname === "/api/ncs/teams" && request.method === "GET") {
        return json(await ncsSearch(Object.fromEntries(url.searchParams), env), 200, headers);
      }
      let match = url.pathname.match(/^\/api\/ncs\/teams\/([^/]+)\/roster$/);
      if (match && request.method === "GET") {
        return json(await ncsRoster(decodeURIComponent(match[1])), 200, headers);
      }
      if (url.pathname === "/api/ncs/events/sync" && request.method === "POST") {
        const body = await readJson(request);
        return json(await ncsEvents(body.teamIds || [], env), 200, headers);
      }
      match = url.pathname.match(/^\/api\/ncs\/events\/([^/]+)\/sync$/);
      if (match && request.method === "POST") {
        const events = await ncsEvents([], env, { eventId: decodeURIComponent(match[1]) });
        return json(events[0] || {}, 200, headers);
      }
      if (url.pathname === "/api/gamechanger/sync" && request.method === "POST") {
        return json(await gameChangerStats(await readJson(request), env), 200, headers);
      }
      if (url.pathname === "/api/gcstats/teams" && request.method === "GET") {
        const { teams } = await loadGcStats(env);
        return json(teams.map(t => ({ ...t, ncs_teams: JSON.parse(t.ncs_teams || "[]") })), 200, headers);
      }
      if (url.pathname === "/api/gcstats/match" && request.method === "POST") {
        const body = await readJson(request);
        const { players: gcPlayers, statsByPlayer } = await loadGcStats(env);
        return json((body.players || []).map(sp => {
          const hit = matchPlayer(sp, gcPlayers);
          return {
            playerId: sp.id ?? null,
            name: sp.name ?? "",
            matched: !!hit,
            matchedNcsPlayerId: hit ? hit.player_id : "",
            matchedName: hit ? hit.name : "",
            rosterTeam: hit ? hit.roster_team : "",
            confidence: hit ? hit.confidence : "none",
            stats: hit ? statsByPlayer[hit.player_id] || null : null
          };
        }), 200, headers);
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      return json({ error: error?.message || "Internal Server Error" }, status, headers);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  }
};

export { parseTeamSearch, parseRoster, parseEvents, extractId, decode };
