import fs from 'node:fs/promises';
import path from 'node:path';

const TEAM_BASE_URL = process.env.GC_TEAM_URL || 'https://web.gc.com/teams/Zn3gbz7yVqgq/2026-spring-ctx-bombers---meza';
const OUTPUT_PATH = process.env.GC_STATS_OUTPUT || 'assets/data/gamechanger-stats.json';
const TEAM_NAME = '2026 Spring CTX Bombers - Meza';

const STAT_PAGES = [
  ['all', `${TEAM_BASE_URL}/stats`],
  ['batting', `${TEAM_BASE_URL}/stats/batting`],
  ['pitching', `${TEAM_BASE_URL}/stats/pitching`],
  ['fielding', `${TEAM_BASE_URL}/stats/fielding`],
  ['catching', `${TEAM_BASE_URL}/stats/catching`],
  ['baserunning', `${TEAM_BASE_URL}/stats/baserunning`]
];

const PLAYER_NAME_KEYS = [
  'playerName', 'athleteName', 'batterName', 'pitcherName', 'fielderName', 'runnerName',
  'fullName', 'displayName', 'name', 'firstLastName', 'lastFirstName'
];
const NUMBER_KEYS = ['number', 'jerseyNumber', 'uniformNumber', 'playerNumber', 'jersey'];
const IGNORED_KEYS = new Set([
  'id', '_id', 'uuid', 'guid', 'playerId', 'athleteId', 'teamId', 'gameId', 'seasonId',
  'image', 'imageUrl', 'avatarUrl', 'profileImageUrl', 'url', 'href', 'slug', 'type', '__typename',
  'createdAt', 'updatedAt', 'deletedAt'
]);

function stripTags(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeKey(key = '') {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value) || value === null;
}

function isStatValue(value) {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return /^-?\d+(\.\d+)?$/.test(v) || /^\.\d+$/.test(v) || /^\d+-\d+$/.test(v) || /^\d+%$/.test(v);
}

function firstStringFromKeys(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object') {
      const nested = firstStringFromKeys(value, keys);
      if (nested) return nested;
    }
  }
  return '';
}

function findJsonScripts(html) {
  const blocks = [];
  const typed = html.matchAll(/<script[^>]+type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of typed) blocks.push(match[1]);
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) blocks.push(nextData[1]);
  return blocks;
}

function walk(value, visit, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) value.forEach(item => walk(item, visit, seen));
  else Object.values(value).forEach(item => walk(item, visit, seen));
}

function normalizeStatsObject(raw, category) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const playerName = firstStringFromKeys(raw, PLAYER_NAME_KEYS) || firstStringFromKeys(raw.player, PLAYER_NAME_KEYS) || firstStringFromKeys(raw.athlete, PLAYER_NAME_KEYS);
  if (!playerName || playerName.length < 2) return null;

  const number = firstStringFromKeys(raw, NUMBER_KEYS) || firstStringFromKeys(raw.player, NUMBER_KEYS) || firstStringFromKeys(raw.athlete, NUMBER_KEYS);
  const stats = {};

  for (const [key, value] of Object.entries(raw)) {
    if (IGNORED_KEYS.has(key)) continue;
    if (PLAYER_NAME_KEYS.includes(key) || NUMBER_KEYS.includes(key)) continue;
    if (!isScalar(value) || !isStatValue(value)) continue;
    stats[normalizeKey(key)] = value === null ? '—' : String(value);
  }

  // Some GC/Next payloads store stat maps inside a nested object.
  for (const nestedKey of ['stats', 'statistics', 'totals', 'seasonStats', 'battingStats', 'pitchingStats', 'fieldingStats']) {
    const nested = raw[nestedKey];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
    for (const [key, value] of Object.entries(nested)) {
      if (!isScalar(value) || !isStatValue(value)) continue;
      stats[normalizeKey(key)] = value === null ? '—' : String(value);
    }
  }

  if (Object.keys(stats).length < 2) return null;
  return {
    category,
    player: playerName,
    number: number || '',
    stats,
    source: 'json'
  };
}

function collectStatsFromJson(json, category) {
  const rows = [];
  walk(json, item => {
    const row = normalizeStatsObject(item, category);
    if (row) rows.push(row);
  });
  return rows;
}

function parseTables(html, category) {
  const rows = [];
  const tableMatches = html.matchAll(/<table[\s\S]*?<\/table>/gi);
  for (const tableMatch of tableMatches) {
    const table = tableMatch[0];
    const headerCells = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]));
    if (!headerCells.length) continue;
    const playerCol = headerCells.findIndex(h => /player|athlete|name/i.test(h));
    if (playerCol < 0) continue;

    const rowMatches = table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const rowMatch of rowMatches) {
      const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripTags(m[1]));
      if (cells.length < 2 || cells.every((cell, i) => cell === headerCells[i])) continue;
      const playerName = cells[playerCol];
      if (!playerName || /player|athlete|name/i.test(playerName)) continue;
      const stats = {};
      headerCells.forEach((header, index) => {
        if (index === playerCol || !header) return;
        const value = cells[index] || '';
        if (value) stats[normalizeKey(header)] = value;
      });
      rows.push({ category, player: playerName, number: '', stats, source: 'html-table' });
    }
  }
  return rows;
}

function dedupeRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.category}|${normalizeName(row.player)}|${Object.keys(row.stats).sort().join(',')}`;
    const existing = byKey.get(key);
    if (!existing || Object.keys(row.stats).length > Object.keys(existing.stats).length) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => normalizeName(a.player).localeCompare(normalizeName(b.player)) || a.category.localeCompare(b.category));
}

function mergePlayerStats(categories) {
  const merged = new Map();
  for (const [category, rows] of Object.entries(categories)) {
    for (const row of rows) {
      const key = normalizeName(row.player);
      if (!key) continue;
      const current = merged.get(key) || { player: row.player, number: row.number || '', categories: {}, allStats: {} };
      if (!current.number && row.number) current.number = row.number;
      current.categories[category] = row.stats;
      for (const [statKey, value] of Object.entries(row.stats)) {
        current.allStats[statKey] = value;
      }
      merged.set(key, current);
    }
  }
  return [...merged.values()].sort((a, b) => normalizeName(a.player).localeCompare(normalizeName(b.player)));
}

async function fetchPage(category, url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'CTXBombersMezaStatsSync/1.0',
      'accept': 'text/html,application/json'
    }
  });
  const html = await response.text();
  const rows = [];
  const warnings = [];

  if (!response.ok) {
    warnings.push(`${category}: HTTP ${response.status} from GameChanger`);
    return { rows, warnings };
  }

  for (const block of findJsonScripts(html)) {
    try {
      rows.push(...collectStatsFromJson(JSON.parse(stripTags(block)), category));
    } catch (error) {
      warnings.push(`${category}: skipped non-parseable JSON block (${error.message})`);
    }
  }
  rows.push(...parseTables(html, category));

  if (!rows.length && /sign in|log in|login|unauthorized|forbidden/i.test(html)) {
    warnings.push(`${category}: GameChanger did not expose public stat rows; staff login or export may be required.`);
  }
  return { rows: dedupeRows(rows), warnings };
}

async function main() {
  const categories = {};
  const warnings = [];

  for (const [category, url] of STAT_PAGES) {
    try {
      const result = await fetchPage(category, url);
      categories[category] = result.rows;
      warnings.push(...result.warnings);
    } catch (error) {
      categories[category] = [];
      warnings.push(`${category}: ${error.message}`);
    }
  }

  const playerStats = mergePlayerStats(categories);
  const output = {
    source: 'GameChanger',
    sourceUrl: `${TEAM_BASE_URL}/stats`,
    team: TEAM_NAME,
    updatedAt: new Date().toISOString(),
    categories,
    playerStats,
    warnings: warnings.length ? warnings : (playerStats.length ? [] : ['No public GameChanger stat rows were found. Upload/export stats from GameChanger if the team stats are private.'])
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${playerStats.length} GameChanger player stat row(s) to ${OUTPUT_PATH}`);
}

main().catch(async error => {
  console.error('GameChanger stats sync failed:', error);
  const fallback = {
    source: 'GameChanger',
    sourceUrl: `${TEAM_BASE_URL}/stats`,
    team: TEAM_NAME,
    updatedAt: new Date().toISOString(),
    categories: { batting: [], pitching: [], fielding: [], catching: [], baserunning: [], all: [] },
    playerStats: [],
    warnings: [`GameChanger stats sync failed: ${error.message}`]
  };
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
  process.exitCode = 0;
});
