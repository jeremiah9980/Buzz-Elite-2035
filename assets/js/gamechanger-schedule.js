const GC_DATA_PATH = 'assets/data/gamechanger-schedule.json';
const GC_STYLESHEET = 'assets/css/gamechanger-schedule.css';

function gcLoadStylesheet() {
  if (document.querySelector(`link[href="${GC_STYLESHEET}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GC_STYLESHEET;
  document.head.appendChild(link);
}

function gcFormatDate(value) {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function gcFormatTime(value) {
  if (!value) return 'Time TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function gcClear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function gcBuildLink(sourceUrl, label) {
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

function gcRenderFallback(container, sourceUrl, message) {
  gcClear(container);
  const wrap = document.createElement('div');
  wrap.className = 'gc-schedule-empty';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'doc-icon';
  const icon = document.createElement('i');
  icon.className = 'ti ti-calendar-event';
  iconWrap.appendChild(icon);

  const content = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'doc-name';
  title.textContent = 'GameChanger Schedule Source';
  const desc = document.createElement('div');
  desc.className = 'doc-desc';
  desc.textContent = message || 'Schedule is connected to GameChanger. Sync data has not populated yet.';
  const actions = document.createElement('div');
  actions.className = 'gc-schedule-actions';
  actions.appendChild(gcBuildLink(sourceUrl, 'Open GameChanger '));

  content.append(title, desc, actions);
  wrap.append(iconWrap, content);
  container.appendChild(wrap);
}

function gcRenderGames(container, data, sourceUrl) {
  const games = Array.isArray(data.games) ? data.games : [];
  if (!games.length) {
    gcRenderFallback(container, sourceUrl, 'No synced games were found yet. Use the GameChanger link until the next sync has schedule data.');
    return;
  }

  gcClear(container);
  const head = document.createElement('div');
  head.className = 'gc-schedule-head';

  const text = document.createElement('div');
  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = 'Live Schedule Source';
  const title = document.createElement('h3');
  title.textContent = 'GameChanger Schedule';
  const updated = document.createElement('p');
  updated.textContent = data.updatedAt
    ? `Synced from GameChanger. Last update: ${new Date(data.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : 'Synced from GameChanger.';
  text.append(label, title, updated);
  head.append(text, gcBuildLink(sourceUrl, 'Open GC '));

  const list = document.createElement('div');
  list.className = 'gc-game-list';

  games.forEach(game => {
    const card = document.createElement('article');
    card.className = 'gc-game-card';

    const date = document.createElement('div');
    date.className = 'gc-game-date';
    const dateStrong = document.createElement('strong');
    dateStrong.textContent = gcFormatDate(game.startTime);
    const timeSpan = document.createElement('span');
    timeSpan.textContent = gcFormatTime(game.startTime);
    date.append(dateStrong, timeSpan);

    const main = document.createElement('div');
    main.className = 'gc-game-main';
    const gameTitle = document.createElement('h4');
    gameTitle.textContent = game.title || game.opponent || 'Primetime Game';
    const location = document.createElement('p');
    location.textContent = game.location || 'Location TBD';
    main.append(gameTitle, location);

    const meta = document.createElement('div');
    meta.className = 'gc-game-meta';
    meta.textContent = game.status || 'Scheduled';

    card.append(date, main, meta);
    list.appendChild(card);
  });

  container.append(head, list);
}

async function loadGameChangerSchedule() {
  gcLoadStylesheet();
  const container = document.querySelector('[data-gamechanger-schedule]');
  if (!container) return;

  const sourceUrl = container.dataset.gamechangerUrl;
  container.textContent = 'Loading GameChanger schedule…';

  try {
    const response = await fetch(`${GC_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Schedule JSON failed: ${response.status}`);
    const data = await response.json();
    gcRenderGames(container, data, sourceUrl || data.sourceUrl);
  } catch (error) {
    console.warn('Unable to load synced GameChanger schedule', error);
    gcRenderFallback(container, sourceUrl, 'Unable to load the synced schedule file. Open GameChanger for the current schedule.');
  }
}

document.addEventListener('DOMContentLoaded', loadGameChangerSchedule);
