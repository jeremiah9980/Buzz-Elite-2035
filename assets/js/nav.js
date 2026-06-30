const currentPath = window.location.pathname;
const currentFile = currentPath.split('/').pop() || 'index.html';
const isPlayerPage = currentPath.includes('/players/');
const isRosterPage = currentPath.includes('/roster/');
const sitePrefix = isPlayerPage || isRosterPage ? '../' : '';
const assetPrefix = sitePrefix;

function ensureThemeAssets() {
  if (!document.querySelector('link[data-buzz-theme-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${assetPrefix}assets/css/theme-toggle.css`;
    link.dataset.buzzThemeCss = 'true';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-buzz-theme-js]')) {
    const script = document.createElement('script');
    script.src = `${assetPrefix}assets/js/theme-toggle.js`;
    script.defer = true;
    script.dataset.buzzThemeJs = 'true';
    document.head.appendChild(script);
  }
}

const NAV_LINKS = [
  ['HOME', `${sitePrefix}index.html#home`, 'home'],
  ['Team Info', `${sitePrefix}index.html#team-info`, 'team-info'],
  ['Roster', `${sitePrefix}roster/`, 'roster'],
  ['Schedule', `${sitePrefix}index.html#schedule`, 'schedule'],
  ['Tournament Tracker', `${sitePrefix}ncs-tracker/`, 'ncs-dashboard'],
  ['Media', `${sitePrefix}index.html#media`, 'media'],
  ['Contact', `${sitePrefix}contact.html`, 'contact'],
];

const logoStyle = 'width:54px;height:54px;border-radius:10px;object-fit:contain;display:block;border:1px solid rgba(255,255,255,.42);box-shadow:0 0 24px rgba(229,9,20,.65);background:#020204;padding:2px;';

const NAV_HTML = `
<nav class="elite-nav">
  <div class="nav-inner">
    <a class="nav-brand" href="${sitePrefix}index.html#home">
      <img class="nav-logo" style="${logoStyle}" src="${assetPrefix}assets/img/buzz-elite-2035-logo.svg" alt="Buzz Elite 2035 logo">
      <strong>Buzz</strong> <span>ELITE 2035</span>
    </a>
    <div class="nav-links">
      ${NAV_LINKS.map(([label, href, id]) => `<a href="${href}" data-anchor-id="${id}">${label}</a>`).join('')}
      <button class="theme-toggle" type="button" aria-label="Switch to light mode" title="Switch to light mode"><i class="ti ti-sun"></i><span class="theme-toggle-label">Light</span></button>
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
  if (document.querySelector('script[data-buzz-player-images]')) return;
  const script = document.createElement('script');
  script.src = `${assetPrefix}assets/js/player-image-data.js`;
  script.defer = true;
  script.dataset.buzzPlayerImages = 'true';
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureThemeAssets();
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  setActiveAnchor();
  loadPlayerImageData();
  window.addEventListener('hashchange', setActiveAnchor);
});
