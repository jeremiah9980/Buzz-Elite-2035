const ROSTER_DATA_PATH = '../assets/data/primetime-players.json';
const GAMECHANGER_STATS_PATH = '../assets/data/gamechanger-stats.json';
const PLAYER_ASSET_ROOT = '../assets/players/';
const ROSTER_STAT_FIELDS = ['AVG', 'OBP', 'OPS', 'RBI'];

function rosterEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeRosterName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function imagePathFor(player) {
  return `${PLAYER_ASSET_ROOT}${player.image}`;
}

function displayNumber(player) {
  const number = String(player.number || '').trim();
  return number || 'TBD';
}

function profilePathFor(player) {
  if (player.profilePath) return player.profilePath;
  if (!player.hasProfile) return '';
  return player.slug === 'romina-alexandra-trevino'
    ? '../players/romina-trevino.html'
    : `../players/${player.slug}.html`;
}

function statsForPlayer(player, statsData) {
  const rows = Array.isArray(statsData?.playerStats) ? statsData.playerStats : [];
  return rows.find(row => normalizeRosterName(row.player) === normalizeRosterName(player.name)) || null;
}

function buildRosterStats(playerStats) {
  if (!playerStats || !playerStats.allStats) return '';
  const stats = playerStats.allStats;
  const hasAny = ROSTER_STAT_FIELDS.some(field => stats[field] !== undefined && stats[field] !== null && stats[field] !== '');
  if (!hasAny) return '';
  return `<div class="player-stat-label">GameChanger Snapshot</div>
    <div class="player-stat-grid">
      ${ROSTER_STAT_FIELDS.map(field => `<div class="player-stat"><strong>${stats[field] ?? '—'}</strong><span>${field}</span></div>`).join('')}
    </div>`;
}

function buildPlayerCard(player, statsData) {
  const card = rosterEl('article', `player-card${player.guest ? ' player-card-guest' : ''}`);
  const number = displayNumber(player);
  const jerseyBadge = number === 'TBD' ? 'TBD' : `#${number}`;
  const profilePath = profilePathFor(player);
  const playerStats = statsForPlayer(player, statsData);
  const statsHTML = buildRosterStats(playerStats);
  const noteHTML = player.note
    ? `<p class="player-note"><i class="ti ti-star-filled"></i> ${player.note}</p>`
    : '';
  const profileHTML = profilePath
    ? `<a href="${profilePath}" class="player-profile-link"><i class="ti ti-id"></i> View Player Profile</a>`
    : `<span class="player-profile-link player-profile-link-disabled"><i class="ti ti-id"></i> Profile Coming Soon</span>`;

  card.innerHTML = `
    <div class="player-photo">
      <span class="player-watermark">${number}</span>
      <img src="${imagePathFor(player)}" alt="${player.name}" class="player-photo-img" loading="lazy">
      <i class="ti ti-user-circle"></i>
      <span class="player-photo-coming">Player Image Coming Soon</span>
      <div class="jersey-badge">${jerseyBadge}</div>
    </div>
    <div class="player-body">
      <h3 class="player-name">${player.name}</h3>
      ${player.guest ? '<div class="player-status"><span class="status-dot"></span> Guest Player</div>' : ''}
      <div class="player-divider"></div>
      ${statsHTML || noteHTML}
      ${statsHTML && noteHTML ? noteHTML : ''}
      ${profileHTML}
    </div>`;

  const img = card.querySelector('img.player-photo-img');
  img.addEventListener('load', () => img.closest('.player-photo').classList.add('has-player-image'));
  img.addEventListener('error', () => img.remove());
  return card;
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

async function loadRoster() {
  const root = document.querySelector('[data-roster-grid]');
  if (!root) return;
  const [rosterResponse, statsData] = await Promise.all([
    fetch(`${ROSTER_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' }),
    loadStatsData()
  ]);
  const players = await rosterResponse.json();
  root.replaceChildren(...players.map(player => buildPlayerCard(player, statsData)));
  window.dispatchEvent(new CustomEvent('bombers-roster-rendered', { detail: { count: players.length } }));
}

document.addEventListener('DOMContentLoaded', loadRoster);
