import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = process.env.GC_SCHEDULE_URL || 'https://web.gc.com/teams/Zn3gbz7yVqgq/2026-spring-ctx-bombers---meza/schedule';
const OUTPUT_PATH = process.env.GC_SCHEDULE_OUTPUT || 'assets/data/gamechanger-schedule.json';
const TEAM_NAME = '2026 Spring CTX Bombers - Meza';

function stripTags(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findJsonScripts(html) {
  const blocks = [];
  const ldJson = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldJson) blocks.push(match[1]);

  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) blocks.push(nextData[1]);
  return blocks;
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  if (Array.isArray(value)) {
    value.forEach(item => walk(item, visit));
  } else {
    Object.values(value).forEach(item => walk(item, visit));
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && typeof value.name === 'string') return value.name.trim();
  }
  return '';
}

function normalizeGame(raw) {
  const startTime = firstString(
    raw.startDate,
    raw.startTime,
    raw.scheduledAt,
    raw.startsAt,
    raw.gameTime,
    raw.eventTime,
    raw.dateTime,
    raw.date
  );

  const title = firstString(
    raw.name,
    raw.title,
    raw.summary,
    raw.description,
    raw.eventName,
    raw.gameName
  );

  const opponent = firstString(
    raw.opponent,
    raw.opponentName,
    raw.awayTeam,
    raw.homeTeam,
    raw.teamName
  );

  const location = firstString(
    raw.location,
    raw.venue,
    raw.place,
    raw.field,
    raw.facility
  );

  const status = firstString(raw.status, raw.gameStatus, raw.state) || 'Scheduled';

  if (!startTime && !title && !opponent) return null;

  return {
    startTime: startTime || null,
    title: title || opponent || 'CTX Bombers Meza Game',
    opponent: opponent || null,
    location: location || null,
    status
  };
}

function collectGamesFromJson(json) {
  const games = [];
  walk(json, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const keys = Object.keys(item).map(key => key.toLowerCase());
    const mightBeEvent = keys.some(key => key.includes('start') || key.includes('date') || key.includes('game')) &&
      keys.some(key => key.includes('team') || key.includes('opponent') || key.includes('event') || key.includes('venue') || key.includes('location') || key.includes('field') || key.includes('name'));

    const type = item['@type'];
    const typedEvent = type === 'Event' || type === 'SportsEvent' || (Array.isArray(type) && type.some(t => t === 'Event' || t === 'SportsEvent'));

    if (mightBeEvent || typedEvent) {
      const game = normalizeGame(item);
      if (game) games.push(game);
    }
  });
  return games;
}

function dedupeGames(games) {
  const seen = new Set();
  return games.filter(game => {
    const key = [game.startTime, game.title, game.location].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'user-agent': 'CTXBombersMezaScheduleSync/1.0',
      'accept': 'text/html,application/json'
    }
  });

  const html = await response.text();
  const games = [];

  for (const block of findJsonScripts(html)) {
    try {
      const json = JSON.parse(stripTags(block));
      games.push(...collectGamesFromJson(json));
    } catch (error) {
      console.warn('Skipped non-parseable JSON block:', error.message);
    }
  }

  const output = {
    source: 'GameChanger',
    sourceUrl: SOURCE_URL,
    team: TEAM_NAME,
    updatedAt: new Date().toISOString(),
    games: dedupeGames(games).slice(0, 60)
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${output.games.length} GameChanger schedule item(s) to ${OUTPUT_PATH}`);
}

main().catch(async error => {
  console.error('GameChanger schedule sync failed:', error);
  const fallback = {
    source: 'GameChanger',
    sourceUrl: SOURCE_URL,
    team: TEAM_NAME,
    updatedAt: new Date().toISOString(),
    games: []
  };
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
  process.exitCode = 0;
});
