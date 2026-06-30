const GC_STATS_DATA_PATH = 'assets/data/gamechanger-stats.json';
const GC_STATS_STYLESHEET = 'assets/css/gamechanger-stats.css';

const GC_STATS_LABELS = {
  all: 'All Stats',
  batting: 'Batting',
  pitching: 'Pitching',
  fielding: 'Fielding',
  catching: 'Catching',
  baserunning: 'Baserunning'
};

function gcStatsLoadStylesheet() {
  if (document.querySelector(`link[href="${GC_STATS_STYLESHEET}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GC_STATS_STYLESHEET;
  document.head.appendChild(link);
}

function gcStatsClear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function gcStatsBuildLink(sourceUrl, label = 'Open GameChanger Stats') {
  const link = document.createElement('a');
  link.className = 'btn-primary';
  link.href = sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  const icon = document.createElement('i');
  icon.className = 'ti ti-external-link';
  link.appendChild(icon);
  return link;
}

function gcStatsNormalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function gcStatsFormatDate(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function gcStatsGetCategories(data) {
  const categories = data && data.categories && typeof data.categories === 'object' ? data.categories : {};
  return Object.entries(categories)
    .filter(([, rows]) => Array.isArray(rows) && rows.length)
    .sort(([a], [b]) => {
      const order = ['all', 'batting', 'pitching', 'fielding', 'catching', 'baserunning'];
      return order.indexOf(a) - order.indexOf(b);
    });
}

function gcStatsFields(rows) {
  const preferred = ['AVG', 'OBP', 'SLG', 'OPS', 'GP', 'PA', 'AB', 'R', 'H', '1B', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'HBP', 'SB', 'CS', 'IP', 'ERA', 'WHIP', 'K', 'PCT', 'A', 'PO', 'E'];
  const found = new Set();
  rows.forEach(row => Object.keys(row.stats || {}).forEach(key => found.add(key)));
  const ordered = preferred.filter(key => found.has(key));
  [...found].sort().forEach(key => {
    if (!ordered.includes(key)) ordered.push(key);
  });
  return ordered.slice(0, 18);
}

function gcStatsRenderEmpty(container, data, sourceUrl) {
  gcStatsClear(container);
  const wrap = document.createElement('div');
  wrap.className = 'gc-stats-empty';
  wrap.innerHTML = `
    <div class="doc-icon"><i class="ti ti-chart-bar"></i></div>
    <div>
      <div class="doc-name">GameChanger Stats Source Connected</div>
      <div class="doc-desc">No public stat rows were found in the synced GameChanger data yet. If team stats are private, export batting, pitching, and fielding CSVs from GameChanger and commit them to the stats importer.</div>
      ${Array.isArray(data?.warnings) && data.warnings.length ? `<ul class="gc-stats-warnings">${data.warnings.slice(0, 4).map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <div class="gc-stats-actions"></div>
    </div>`;
  wrap.querySelector('.gc-stats-actions').appendChild(gcStatsBuildLink(sourceUrl));
  container.appendChild(wrap);
}

function gcStatsRenderSummary(container, data, sourceUrl) {
  const players = Array.isArray(data.playerStats) ? data.playerStats : [];
  const categories = gcStatsGetCategories(data);
  const summary = document.createElement('div');
  summary.className = 'gc-stats-head';
  summary.innerHTML = `
    <div>
      <div class="section-label">Live Stats Source</div>
      <h3>GameChanger Stats</h3>
      <p>${players.length} player stat profile${players.length === 1 ? '' : 's'} · ${categories.length} stat categor${categories.length === 1 ? 'y' : 'ies'} · Last sync: ${gcStatsFormatDate(data.updatedAt)}</p>
    </div>`;
  summary.appendChild(gcStatsBuildLink(sourceUrl, 'Open GC Stats'));
  container.appendChild(summary);

  const metrics = document.createElement('div');
  metrics.className = 'gc-stats-metrics';
  const statCount = players.reduce((sum, row) => sum + Object.keys(row.allStats || {}).length, 0);
  metrics.innerHTML = `
    <div><strong>${players.length}</strong><span>Players</span></div>
    <div><strong>${categories.length}</strong><span>Categories</span></div>
    <div><strong>${statCount}</strong><span>Stat Fields</span></div>`;
  container.appendChild(metrics);
}

function gcStatsBuildTable(category, rows) {
  const fields = gcStatsFields(rows);
  const panel = document.createElement('article');
  panel.className = 'gc-stats-table-panel';
  panel.innerHTML = `
    <div class="gc-stats-table-head">
      <div>
        <span>${GC_STATS_LABELS[category] || category}</span>
        <h4>${rows.length} Player${rows.length === 1 ? '' : 's'}</h4>
      </div>
    </div>`;

  const wrap = document.createElement('div');
  wrap.className = 'gc-stats-table-wrap';
  const table = document.createElement('table');
  table.className = 'gc-stats-table';
  table.innerHTML = `<thead><tr><th>Player</th>${fields.map(field => `<th>${field}</th>`).join('')}</tr></thead>`;
  const tbody = document.createElement('tbody');
  rows
    .slice()
    .sort((a, b) => gcStatsNormalizeName(a.player).localeCompare(gcStatsNormalizeName(b.player)))
    .forEach(row => {
      const tr = document.createElement('tr');
      const jersey = row.number ? `<span class="gc-stat-number">#${row.number}</span>` : '';
      tr.innerHTML = `<td>${jersey}${row.player || 'Unknown Player'}</td>${fields.map(field => `<td>${row.stats?.[field] ?? '—'}</td>`).join('')}`;
      tbody.appendChild(tr);
    });
  table.appendChild(tbody);
  wrap.appendChild(table);
  panel.appendChild(wrap);
  return panel;
}

function gcStatsRenderTables(container, data) {
  const categories = gcStatsGetCategories(data);
  const grid = document.createElement('div');
  grid.className = 'gc-stats-table-grid';
  categories.forEach(([category, rows]) => grid.appendChild(gcStatsBuildTable(category, rows)));
  container.appendChild(grid);
}

async function loadGameChangerStats() {
  gcStatsLoadStylesheet();
  const container = document.querySelector('[data-gamechanger-stats]');
  if (!container) return;
  const sourceUrl = container.dataset.gamechangerStatsUrl || 'https://web.gc.com/teams/Zn3gbz7yVqgq/2026-spring-ctx-bombers---meza/stats';
  container.textContent = 'Loading GameChanger stats…';

  try {
    const response = await fetch(`${GC_STATS_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Stats JSON failed: ${response.status}`);
    const data = await response.json();
    const categories = gcStatsGetCategories(data);
    if (!categories.length) {
      gcStatsRenderEmpty(container, data, sourceUrl || data.sourceUrl);
      return;
    }
    gcStatsClear(container);
    gcStatsRenderSummary(container, data, sourceUrl || data.sourceUrl);
    gcStatsRenderTables(container, data);
  } catch (error) {
    console.warn('Unable to load synced GameChanger stats', error);
    gcStatsRenderEmpty(container, { warnings: ['Unable to load the synced GameChanger stats file.'] }, sourceUrl);
  }
}

document.addEventListener('DOMContentLoaded', loadGameChangerStats);
