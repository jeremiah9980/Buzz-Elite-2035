import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('NCS CMS defaults to Texas fastpitch season 33', () => {
  assert.match(cmsJs, /https:\/\/playncs\.com\/fastpitch\/Teams/);
  assert.match(cmsJs, /seasonId:'33'/);
  assert.match(cmsJs, /country:'US'/);
  assert.match(cmsJs, /state:'TX'/);
});

test('CMS implements safe demo mode and diagnostics', () => {
  assert.match(cmsJs, /demoMode:true/);
  assert.match(cmsJs, /runDiagnostics/);
  assert.match(cmsJs, /NCS team search/);
  assert.match(cmsJs, /GameChanger stats synchronization/);
  assert.match(cmsJs, /Tournament event synchronization/);
  assert.match(cmsJs, /Per-event tracker refresh/);
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

test('Worker builds exact PlayNCS team search parameters', () => {
  assert.match(worker, /NCS_TEAMS_BASE_URL/);
  assert.match(worker, /NCS_SEASON_ID/);
  assert.match(worker, /NCS_COUNTRY/);
  assert.match(worker, /NCS_STATE/);
  assert.match(worker, /url\.searchParams\.set\("seasonId"/);
  assert.match(worker, /url\.searchParams\.set\("teamName"/);
});

test('Worker defaults to any age and applies verified mappings only when selected', () => {
  assert.match(worker, /defaultAge:\s*"any"/);
  assert.match(worker, /"10U":\s*"4"/);
  assert.match(worker, /"12U":\s*"6"/);
  assert.match(worker, /if \(ageId\) url\.searchParams\.set\("ageId", ageId\)/);
  assert.doesNotMatch(wrangler, /^NCS_AGE_ID\s*=/m);
});

test('Worker cron is configured for every 15 minutes', () => {
  assert.match(wrangler, /crons\s*=\s*\["\*\/15 \* \* \* \*"\]/);
});

test('Provider adapters fail closed until authorized implementations exist', () => {
  assert.match(worker, /NCS adapter is not configured/);
  assert.match(worker, /GameChanger adapter is not configured/);
  assert.doesNotMatch(worker, /password\s*=|sessionCookie|document\.cookie/i);
});
