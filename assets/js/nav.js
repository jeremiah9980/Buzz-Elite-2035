const currentPath = window.location.pathname;
const currentFile = currentPath.split('/').pop() || 'index.html';
const isHomePage = currentFile === 'index.html' || currentFile === '';
const isPlayerPage = currentPath.includes('/players/');
const isRosterPage = currentPath.includes('/roster/');
const sitePrefix = isPlayerPage || isRosterPage ? '../' : '';
const assetPrefix = sitePrefix;

const NAV_LINKS = [
  ['HOME', `${sitePrefix}index.html#home`, 'home'],
  ['Team Info', `${sitePrefix}index.html#team-info`, 'team-info'],
  ['Roster', `${sitePrefix}roster/`, 'roster'],
  ['Schedule', `${sitePrefix}index.html#schedule`, 'schedule'],
  ['GC Stats', `${sitePrefix}index.html#stats`, 'stats'],
  ['Social', `${sitePrefix}index.html#social`, 'social'],
  ['NCS Dashboard', `${sitePrefix}ncs-tracker/`, 'ncs-dashboard'],
  ['Fundraising', `${sitePrefix}index.html#fundraising`, 'fundraising'],
];

const logoStyle = 'width:42px;height:42px;border-radius:50%;object-fit:cover;display:block;border:2px solid #075DFF;box-shadow:0 0 18px rgba(7,93,255,.45);background:#02040A;';

const NAV_HTML = `
<nav>
  <div class="nav-inner">
    <a class="nav-brand" href="${sitePrefix}index.html#home">
      <img class="nav-logo" style="${logoStyle}" src="${assetPrefix}assets/img/bombers-fastpitch-logo.svg" alt="Bombers Fastpitch logo">
      Bombers <span>FASTPITCH</span>
    </a>
    <div class="nav-links">
      ${NAV_LINKS.map(([label, href, id]) => `<a href="${href}" data-anchor-id="${id}">${label}</a>`).join('')}
    </div>
  </div>
</nav>`;

function setActiveAnchor() {
  const activeId = isRosterPage || isPlayerPage ? 'roster' : (window.location.hash || '#home').replace('#', '');
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.anchorId === activeId);
  });
}

function loadPlayerImageData() {
  if (document.querySelector('script[data-bombers-player-images]')) return;
  const script = document.createElement('script');
  script.src = `${assetPrefix}assets/js/player-image-data.js`;
  script.defer = true;
  script.dataset.bombersPlayerImages = 'true';
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  setActiveAnchor();
  loadPlayerImageData();
  window.addEventListener('hashchange', setActiveAnchor);
});