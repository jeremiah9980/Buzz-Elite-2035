const PROFILE_DATA_PATH = '../assets/data/primetime-players.json';
const GAMECHANGER_STATS_PATH = '../assets/data/gamechanger-stats.json';
const PLAYER_ASSET_ROOT = '../assets/players/';

const CURRENT_FIELDS = ['AVG', 'OBP', 'SLG', 'OPS', 'H', 'RBI', 'SB', 'SB%'];
const ALL_TIME_FIELDS = ['GP', 'PA', 'AB', 'AVG', 'OBP', 'SLG', 'OPS', 'H', '1B', '2B', '3B', 'HR', 'RBI', 'R', 'BB', 'SO', 'HBP', 'SB', 'SB%', 'CS'];
const CLIP_TAGS = ['HOME RUN', 'GAME CLIP', 'GAME CLIP', 'TOP PLAY', 'GAME CLIP', 'HOME RUN', 'TOP PLAY', 'GAME CLIP'];

function profileEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function placeholderStats(fields) {
  return Object.fromEntries(fields.map(field => [field, '—']));
}

function displayNumber(player) {
  const number = String(player.number || '').trim();
  return number || 'TBD';
}

function statsForPlayer(player, statsData) {
  const statsRows = Array.isArray(statsData?.playerStats) ? statsData.playerStats : [];
  const match = statsRows.find(row => normalizeName(row.player) === normalizeName(player.name));
  if (!match) return null;
  const allStats = match.allStats || {};
  return {
    currentStats: Object.fromEntries(CURRENT_FIELDS.map(field => [field, allStats[field] || '—'])),
    allTimeStats: Object.fromEntries(ALL_TIME_FIELDS.map(field => [field, allStats[field] || '—'])),
    categories: match.categories || {},
    syncedAt: statsData.updatedAt || null
  };
}

function buildHero(player) {
  const hero = profileEl('section', 'profile-hero');
  const number = displayNumber(player);
  const role = player.guest ? 'Guest Athlete' : 'Rostered Athlete';
  hero.innerHTML = `
    <div class="profile-kicker">CTX Bombers Meza · Georgetown, Texas · 2026</div>
    <h1><span>#${number}</span> ${player.name}</h1>
    <div class="profile-role">${role}</div>
    <div class="profile-hero-rule"></div>
    <p>${player.name}'s player profile, current in-season GameChanger snapshot, character profile, all-time stats, and highlight wall are shown below.</p>`;
  return hero;
}

function buildPhotoCard(player) {
  const card = profileEl('article', 'profile-photo-card');
  const number = displayNumber(player);
  const image = player.image ? `${PLAYER_ASSET_ROOT}${player.image}` : '';
  card.innerHTML = `
    <span class="profile-photo-watermark">${number}</span>
    ${image ? `<img class="profile-player-image" src="${image}" alt="${player.name} Bombers player graphic" loading="eager">` : ''}
    <i class="ti ti-user-circle"></i>
    <div class="profile-photo-label">
      <strong>${image ? 'Player Graphic' : 'Player Image Coming Soon'}</strong>
      <span class="profile-number-badge">#${number}</span>
    </div>`;
  const img = card.querySelector('.profile-player-image');
  if (img) {
    img.addEventListener('load', () => card.classList.add('has-player-image'));
    img.addEventListener('error', () => {
      img.remove();
      card.classList.remove('has-player-image');
      const label = card.querySelector('.profile-photo-label strong');
      if (label) label.textContent = 'Player Image Coming Soon';
    });
  }
  return card;
}

function buildSnapshotPanel(player, gcStats) {
  const stats = gcStats?.currentStats || player.currentStats || placeholderStats(CURRENT_FIELDS);
  const panel = profileEl('article', 'profile-panel');
  const label = profileEl('div', 'profile-section-label', `${player.name.split(' ')[0]} · Player Profile`);
  const h2 = profileEl('h2', '', 'GameChanger Snapshot');
  const p = profileEl('p', '', gcStats
    ? `Verified source: 2026 Spring CTX Bombers - Meza GameChanger snapshot${gcStats.syncedAt ? ` · ${new Date(gcStats.syncedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}.`
    : 'Verified GameChanger stat slots are connected and ready to populate once public stat rows or exported team stats are available.');
  const grid = profileEl('div', 'stat-grid');

  CURRENT_FIELDS.forEach(field => {
    const tile = profileEl('div', 'stat-tile');
    tile.innerHTML = `<strong>${stats[field] || '—'}</strong><span>${field}</span>`;
    grid.appendChild(tile);
  });

  panel.append(label, h2, p, grid);
  return panel;
}

function buildCharacter(player) {
  const block = profileEl('section', 'profile-block character-block');
  const inner = profileEl('div', 'profile-block-inner');
  const quote = player.quote || `${player.name} brings effort, coachability, and team-first energy to CTX Bombers Meza.`;
  const bullets = Array.isArray(player.characterBullets) && player.characterBullets.length
    ? player.characterBullets
    : [
      'Coachability: responds to feedback and keeps improving.',
      'Team-first habits: supports teammates and keeps the group moving.',
      'Development focus: continues building consistency and confidence.'
    ];
  inner.innerHTML = `
    <div class="profile-section-label">Coach Notes</div>
    <h2>Character Profile</h2>
    <div class="character-grid">
      <div class="coach-quote">
        “${quote}”
        <span>Bombers coach profile</span>
      </div>
      <ul class="character-list">
        ${bullets.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>`;
  block.appendChild(inner);
  return block;
}

function buildAllTimeStats(player, gcStats) {
  const stats = gcStats?.allTimeStats || player.allTimeStats || placeholderStats(ALL_TIME_FIELDS);
  const block = profileEl('section', 'profile-block');
  const inner = profileEl('div', 'profile-block-inner');
  const table = profileEl('table', 'stats-table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  thead.innerHTML = `<tr>${ALL_TIME_FIELDS.map(field => `<th>${field}</th>`).join('')}</tr>`;
  tbody.innerHTML = `<tr>${ALL_TIME_FIELDS.map(field => `<td>${stats[field] || '—'}</td>`).join('')}</tr>`;
  table.append(thead, tbody);

  const wrap = profileEl('div', 'stats-table-wrap');
  wrap.appendChild(table);
  inner.innerHTML = `<div class="profile-section-label">Performance</div><h2>All-Time Stats</h2>`;
  inner.appendChild(wrap);
  block.appendChild(inner);
  return block;
}

function buildFilmRoom(player) {
  const block = profileEl('section', 'profile-block film-block');
  const inner = profileEl('div', 'profile-block-inner');
  inner.innerHTML = `
    <div class="film-head">
      <div>
        <div class="profile-section-label">Film Room</div>
        <h2>At The Plate</h2>
        <p>Highlight reel wall for game clips, swings, defensive plays, and player development moments.</p>
      </div>
      <a class="full-folder-link" href="#"><i class="ti ti-folder"></i> Full Folder</a>
    </div>
    <div class="film-filters">
      <button type="button">All</button>
      <button type="button">Home Runs</button>
      <button type="button">Hits</button>
      <button type="button">Doubles</button>
      <button type="button">Defense</button>
    </div>`;

  const clips = profileEl('div', 'clip-grid');
  CLIP_TAGS.forEach((tag, index) => {
    const clip = profileEl('article', 'clip-card');
    clip.innerHTML = `
      <div class="play-dot"><i class="ti ti-player-play-filled"></i></div>
      <div>
        <span class="clip-tag">${tag}</span>
        <h3>Game Clip ${String(index + 1).padStart(2, '0')}</h3>
        <p>${player.name} · CTX Bombers Meza</p>
      </div>`;
    clips.appendChild(clip);
  });

  inner.appendChild(clips);
  block.appendChild(inner);
  return block;
}

function buildFooter() {
  const footer = profileEl('footer', 'profile-footer');
  footer.innerHTML = `
    <h2>Bombers Fastpitch</h2>
    <div class="profile-hero-rule"></div>
    <div class="profile-footer-links">
      <a href="../index.html#home">Home</a>
      <a href="../roster/">Roster</a>
      <a href="../index.html#schedule">Schedule</a>
      <a href="../index.html#stats">GC Stats</a>
      <a href="../ncs-tracker/">NCS Dashboard</a>
    </div>
    <p>Georgetown, Texas · 10U Select Fastpitch Softball · 2026</p>`;
  return footer;
}

async function loadStatsData() {
  try {
    const response = await fetch(`${GAMECHANGER_STATS_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function renderPlayerProfile() {
  const root = document.getElementById('player-profile-root');
  if (!root) return;

  const slug = document.body.dataset.playerSlug;
  const [playersResponse, statsData] = await Promise.all([
    fetch(`${PROFILE_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' }),
    loadStatsData()
  ]);
  const players = await playersResponse.json();
  const player = players.find(item => item.slug === slug) || players[0];
  const gcStats = statsForPlayer(player, statsData);
  const number = displayNumber(player);

  document.title = `#${number} ${player.name} · CTX Bombers Meza`;

  const shell = profileEl('div', 'player-profile-shell');
  shell.appendChild(buildHero(player));

  const main = profileEl('main', 'profile-main');
  const top = profileEl('div', 'profile-top-grid');
  top.append(buildPhotoCard(player), buildSnapshotPanel(player, gcStats));
  main.append(top, buildCharacter(player), buildAllTimeStats(player, gcStats), buildFilmRoom(player));

  const back = profileEl('a', 'back-roster', '← Back to Roster');
  back.href = '../roster/';
  main.appendChild(back);

  shell.append(main, buildFooter());
  root.appendChild(shell);
  window.dispatchEvent(new CustomEvent('bombers-player-profile-rendered', { detail: { slug: player.slug } }));
}

document.addEventListener('DOMContentLoaded', renderPlayerProfile);
