import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseTeamSearch, parseRoster, parseEvents, extractId } from '../worker/src/index.js';

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
