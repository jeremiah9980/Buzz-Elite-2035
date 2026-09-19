import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseTeamSearch, parseRoster, parseEvents, extractId, extractGcTeamId, normalizeGcPlayer, matchGcRosterPlayer } from '../worker/src/index.js';

const cmsHtml = await readFile(new URL('../../cms/integrations.html', import.meta.url), 'utf8');
const cmsJs = await readFile(new URL('../../cms/integrations.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const wrangler = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');

const requiredViews = [
  'overview', 'ncs', 'roster', 'gamechanger', 'tournaments',
  'trackers', 'diagnostics', 'settings'
];

for (const id of requiredViews) {
  test(`CMS includes ${id} view`, () => {
    assert.match(cmsHtml, new RegExp(`id=["']${id}["']`));
  });
}

test('CMS includes all critical workflow controls', () => {
  for (const id of [
    'searchNcs', 'importSelected', 'addPlayer', 'syncStats',
    'addTournamentTeam', 'syncEvents', 'runAllTests'
  ]) {
    assert.match(cmsHtml, new RegExp(`id=["']${id}["']`));
  }
});

test('CMS points at the integrations Worker, not playncs.com directly', () => {
  assert.match(cmsJs, /API_URL='https:\/\/buzz-elite-integrations\.jeremiahcargill\.workers\.dev'/);
  assert.match(cmsJs, /apiBaseUrl:API_URL/);
  // Saved drafts that pointed the API at playncs.com (which has no API/CORS) migrate to the Worker.
  assert.match(cmsJs, /state\.apiBaseUrl\.includes\('playncs\.com'\)/);
});

test('CMS diagnostics view is navigable and runs tests', () => {
  assert.match(cmsJs, /diagnostics:\['Diagnostics'/);
  assert.match(cmsJs, /function runAllTests/);
  assert.match(cmsJs, /rat\.onclick=runAllTests/);
});

test('CMS preserves explicit cross-provider player IDs', () => {
  assert.match(cmsJs, /ncsPlayerId/);
  assert.match(cmsJs, /gameChangerPlayerId/);
  assert.match(cmsJs, /requireManualMatchApproval/);
  assert.match(cmsJs, /preserveManualEdits/);
});

test('Worker exposes all required integration routes', () => {
  for (const route of [
    '/api/health', '/api/config', '/api/ncs/teams',
    '/api/ncs/events/sync', '/api/gamechanger/sync', '/api/sync/run'
  ]) {
    assert.ok(worker.includes(route), `Missing ${route}`);
  }
});

test('Worker maps division names to verified NCS age IDs', () => {
  assert.match(worker, /"10u": "4"/);
  assert.match(worker, /"12u": "6"/);
  assert.match(worker, /if \(AGE_IDS\[division\]\) q\.set\("ageId", AGE_IDS\[division\]\)/);
});

test('Worker cron is configured for every 15 minutes', () => {
  assert.match(wrangler, /crons\s*=\s*\["\*\/15 \* \* \* \*"\]/);
});

test('Worker protects admin routes with bearer authentication', () => {
  assert.match(worker, /INTEGRATION_API_TOKEN/);
  assert.match(worker, /Bearer/);
  assert.match(worker, /Unauthorized/);
  assert.match(worker, /authorizeMutation\(request, env\)/);
});

test('GameChanger adapter fails closed (no public API)', () => {
  assert.match(worker, /GameChanger has no public API/);
  assert.doesNotMatch(worker, /password\s*=|sessionCookie|document\.cookie/i);
});

/* ---- parser unit tests against real playncs.com markup shapes ---- */

const searchFixture = `
<tr>
  <td>
    <a href="/fastpitch/Teams/Details/87980/primetime-10u-graves">
      Primetime 10U Graves
    </a>
    <div class="visible-xs">Round Rock, TX</div>
  </td>
  <td>
    10U C
  </td>
  <td class="hidden-xs">
    Round Rock, TX
  </td>
  <td class="text-nowrap">
    0-0-0
  </td>
</tr>`;

test('parseTeamSearch extracts id, name, division, location', () => {
  const teams = parseTeamSearch(searchFixture);
  assert.equal(teams.length, 1);
  assert.deepEqual(
    { id: teams[0].id, name: teams[0].name, division: teams[0].division, location: teams[0].location },
    { id: '87980', name: 'Primetime 10U Graves', division: '10U C', location: 'Round Rock, TX' }
  );
});

const rosterFixture = `
id="collapse-roster" class="panel-collapse collapse">
<table>
  <tbody>
    <tr>
      <td>15</td>
      <td>
        <a href="/fastpitch/Players/Details/412663/andi-gilliland">
          Andi Gilliland
        </a>
      </td>
    </tr>
  </tbody>
</table>`;

test('parseRoster extracts NCS player id, number, and name', () => {
  const roster = parseRoster(rosterFixture);
  assert.equal(roster.length, 1);
  assert.equal(roster[0].id, '412663');
  assert.equal(roster[0].number, '15');
  assert.equal(roster[0].name, 'Andi Gilliland');
});

const eventsFixture = `
id="collapse-events" class="panel-collapse collapse">
<div class="media ">
  <div class="media-top"><div class="h5 stature">Tournament</div></div>
  <div class="media-body">
    <div class="h6"><span>GEORGETOWN, TX</span></div>
    <div class="h4">
      <a href="/fastpitch/Events/Details/13415/back-to-school-blues">
        BACK TO SCHOOL BLUES
      </a>
    </div>
    <div class="h4">
      Aug 29-30
    </div>
  </div>
</div>`;

test('parseEvents extracts event id, name, date, and location', () => {
  const events = parseEvents(eventsFixture);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, '13415');
  assert.equal(events[0].name, 'BACK TO SCHOOL BLUES');
  assert.equal(events[0].startDate, 'Aug 29-30');
  assert.equal(events[0].location, 'GEORGETOWN, TX');
});

test('extractId accepts raw ids and pasted playncs URLs', () => {
  assert.equal(extractId('87980'), '87980');
  assert.equal(extractId('https://playncs.com/fastpitch/Teams/Details/87980/primetime-10u-graves'), '87980');
  assert.equal(extractId('not-a-team'), null);
});

/* ---------------- GameChanger roster matching ---------------- */

const gcRosterFixture = [
  { id: 'gc-1', name: 'Avery Gilliland', number: '7' },
  { id: 'gc-2', name: 'Bailey Ortiz', number: '12' },
  { id: 'gc-3', name: 'Brooke Ortiz', number: '7' },
  { id: 'gc-4', name: 'Casey Gauthier', number: '3' }
];

test('extractGcTeamId accepts raw ids and pasted web.gc.com URLs', () => {
  assert.equal(extractGcTeamId('pk8GN5ZYVEV9'), 'pk8GN5ZYVEV9');
  assert.equal(extractGcTeamId('https://web.gc.com/teams/pk8GN5ZYVEV9/stats'), 'pk8GN5ZYVEV9');
  assert.equal(extractGcTeamId('  https://web.gc.com/teams/pk8GN5ZYVEV9  '), 'pk8GN5ZYVEV9');
  assert.equal(extractGcTeamId(''), null);
  assert.equal(extractGcTeamId('short'), null);
});

test('normalizeGcPlayer handles snake_case, camelCase, and combined names', () => {
  assert.deepEqual(normalizeGcPlayer({ id: 9, first_name: 'Avery', last_name: 'Gilliland', number: 7 }),
    { id: '9', name: 'Avery Gilliland', number: '7' });
  assert.deepEqual(normalizeGcPlayer({ playerId: 'x1', firstName: 'Bailey', lastName: 'Ortiz', jerseyNumber: '#12' }),
    { id: 'x1', name: 'Bailey Ortiz', number: '12' });
  assert.deepEqual(normalizeGcPlayer({ id: 'x2', name: 'Casey  Gauthier' }),
    { id: 'x2', name: 'Casey Gauthier', number: '' });
});

test('matchGcRosterPlayer uses jersey + last name for an exact match', () => {
  // Two Ortiz players; the jersey number disambiguates.
  const hit = matchGcRosterPlayer({ name: 'B. Ortiz', number: '12' }, gcRosterFixture);
  assert.equal(hit.id, 'gc-2');
  assert.equal(hit.confidence, 'exact');
});

test('matchGcRosterPlayer falls back to a full name match', () => {
  const hit = matchGcRosterPlayer({ name: 'Brooke Ortiz' }, gcRosterFixture);
  assert.equal(hit.id, 'gc-3');
  assert.equal(hit.confidence, 'name');
});

test('matchGcRosterPlayer reports last name + initial as partial', () => {
  // Nickname on the website, legal name in GameChanger: same last name and initial only.
  const hit = matchGcRosterPlayer({ name: 'Case Gauthier' }, gcRosterFixture);
  assert.equal(hit.id, 'gc-4');
  assert.equal(hit.confidence, 'partial');
});

test('matchGcRosterPlayer treats a name suffix as the last name', () => {
  // Known limitation: normName keeps "Jr"/"III", so the suffix becomes the surname
  // and no match is found. Such players need their ID approved or entered by hand.
  assert.equal(matchGcRosterPlayer({ name: 'Casey Gauthier Jr' }, gcRosterFixture), null);
});

test('matchGcRosterPlayer refuses ambiguous and empty input', () => {
  // "Ortiz" alone matches two roster players, so no match is returned.
  assert.equal(matchGcRosterPlayer({ name: 'Ortiz' }, gcRosterFixture), null);
  assert.equal(matchGcRosterPlayer({ name: '' }, gcRosterFixture), null);
  assert.equal(matchGcRosterPlayer({ name: 'Dana Nobody' }, gcRosterFixture), null);
});

test('Worker uses the authenticated GameChanger roster route, not a public one', () => {
  // GameChanger's unauthenticated surface has no roster; /public/teams/:id/players is a 404.
  assert.ok(!worker.includes('/public/teams/${'), 'Worker must not fetch a public GC roster endpoint');
  assert.match(worker, /"gc-token": token/);
  assert.match(worker, /env\.GC_TOKEN/);
});

test('wrangler.toml documents the GC_TOKEN secret', () => {
  assert.match(wrangler, /wrangler secret put GC_TOKEN/);
});
