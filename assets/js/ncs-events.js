const NCS_DATA_PATH = 'assets/data/ncs-events.json';

function ncsDateLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || 'TBD';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function ncsClear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ncsMetric(label, value) {
  const card = document.createElement('div');
  card.className = 'ncs-metric-card';
  card.innerHTML = `<strong>${value || '—'}</strong><span>${label}</span>`;
  return card;
}

function ncsEventCard(event) {
  const card = document.createElement('article');
  card.className = 'ncs-event-card';
  card.innerHTML = `
    <div class="ncs-event-date">${ncsDateLabel(event.date)}</div>
    <div class="ncs-event-main">
      <h4>${event.event}</h4>
      <p>${event.division || 'Division TBD'} · Record ${event.record || '—'}</p>
    </div>
    <div class="ncs-event-place">${event.place ? `#${event.place}` : '—'}<span>Place</span></div>`;
  return card;
}

function ncsRenderList(node, events, emptyText) {
  ncsClear(node);
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'ncs-empty';
    empty.textContent = emptyText;
    node.appendChild(empty);
    return;
  }
  events.forEach(event => node.appendChild(ncsEventCard(event)));
}

async function loadNcsEvents() {
  const container = document.querySelector('[data-ncs-events]');
  if (!container) return;

  try {
    const response = await fetch(`${NCS_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`NCS JSON failed: ${response.status}`);
    const data = await response.json();

    const metrics = container.querySelector('[data-ncs-metrics]');
    const upcoming = container.querySelector('[data-ncs-upcoming]');
    const past = container.querySelector('[data-ncs-past]');
    const source = container.querySelector('[data-ncs-source]');

    if (metrics) {
      ncsClear(metrics);
      metrics.append(
        ncsMetric('Record', data.record),
        ncsMetric('Win %', data.winPct),
        ncsMetric('Last 10', data.last10),
        ncsMetric('Streak', data.streak),
        ncsMetric('Ranking Points', data.rankingPoints),
        ncsMetric('Avg Runs Scored', data.avgRunsScored),
        ncsMetric('Avg Runs Allowed', data.avgRunsAllowed)
      );
    }

    if (upcoming) ncsRenderList(upcoming, data.upcomingEvents || [], 'No upcoming NCS events are listed on the team page right now.');
    if (past) ncsRenderList(past, data.pastEvents || [], 'No past NCS events loaded yet.');
    if (source) source.href = data.sourceUrl;
  } catch (error) {
    console.warn('Unable to load NCS events', error);
  }
}

document.addEventListener('DOMContentLoaded', loadNcsEvents);
