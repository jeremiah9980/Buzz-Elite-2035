window.PRIMETIME_PLAYER_IMAGE_BASE = window.location.pathname.includes('/players/') || window.location.pathname.includes('/roster/') ? '../assets/players/' : 'assets/players/';

window.PRIMETIME_PLAYER_IMAGES = window.PRIMETIME_PLAYER_IMAGES || {
  'kylie-collins': 'kylie-c.jpg',
  'zoey-arabella-vela': 'zoey-v.jpg',
  'khloe-lazo': 'khloe-l.jpg',
  'jordynn-wright': 'jordynn-w.jpg',
  'araceli-sophia-noveron': 'araceli-n.jpg',
  'lyla-terrazas': 'lyla-t.jpg',
  'elena-alejandra-grimaldo': 'elena-g.jpg',
  'ella-gamble': 'ella-g.jpg',
  'romina-alexandra-trevino': 'romina-t.jpg',
  'sophia-texas-hill': 'sophia-h.jpg',
  'zeriyah-campos': 'zeriyah-c.jpg'
};

(function primePlayerImages() {
  const STYLE_ID = 'primetime-player-image-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .primetime-page .player-photo-img,
      .primetime-page .profile-photo-img {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .primetime-page .player-photo-coming {
        position: absolute;
        z-index: 2;
        bottom: 78px;
        left: 16px;
        right: 16px;
        text-align: center;
        font-family: var(--display);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.4px;
        text-transform: uppercase;
        color: rgba(255,255,255,.65);
      }
      .primetime-page .player-photo.has-player-image > i,
      .primetime-page .player-photo.has-player-image .player-photo-coming,
      .primetime-page .profile-photo-card.has-player-image > i {
        display: none !important;
      }
      .primetime-page .player-photo.has-player-image:after,
      .primetime-page .profile-photo-card.has-player-image:after {
        z-index: 1;
      }
      .primetime-page .player-photo.has-player-image .player-watermark,
      .primetime-page .profile-photo-card.has-player-image .profile-photo-watermark {
        z-index: 2;
      }
      .primetime-page .player-photo.has-player-image .jersey-badge,
      .primetime-page .profile-photo-card.has-player-image .profile-photo-label {
        z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  function srcFor(fileName) {
    return `${window.PRIMETIME_PLAYER_IMAGE_BASE}${fileName}`;
  }

  function profileHrefFor(slug) {
    return slug === 'romina-alexandra-trevino' ? 'romina-trevino.html' : `${slug}.html`;
  }

  function attachImage(img, photo) {
    img.addEventListener('load', () => photo.classList.add('has-player-image'));
    img.addEventListener('error', () => img.remove());
  }

  function setRosterPhoto(slug, fileName) {
    const link = document.querySelector(`a.player-profile-link[href$="${profileHrefFor(slug)}"]`);
    if (!link) return;
    const card = link.closest('.player-card');
    const photo = card && card.querySelector('.player-photo');
    if (!photo || photo.querySelector('img.player-photo-img')) return;

    const name = card.querySelector('.player-name')?.textContent?.trim() || 'Primetime player';
    const img = document.createElement('img');
    img.className = 'player-photo-img';
    img.src = srcFor(fileName);
    img.alt = name;
    img.loading = 'lazy';

    const icon = photo.querySelector('i');
    if (icon) icon.before(img);
    else photo.insertBefore(img, photo.firstChild);
    attachImage(img, photo);
  }

  function setProfilePhoto(slug, fileName) {
    if (document.body.dataset.playerSlug !== slug) return;
    const photo = document.querySelector('.profile-photo-card');
    if (!photo || photo.querySelector('img.profile-photo-img')) return;

    const playerName = document.querySelector('.profile-hero h1')?.textContent?.replace(/^#\d+\s*/, '').trim() || 'Primetime player';
    const img = document.createElement('img');
    img.className = 'profile-photo-img';
    img.src = srcFor(fileName);
    img.alt = playerName;

    const icon = photo.querySelector('i');
    if (icon) icon.before(img);
    else photo.insertBefore(img, photo.firstChild);
    const label = photo.querySelector('.profile-photo-label strong');
    if (label) label.textContent = playerName;
    attachImage(img, photo);
  }

  function applyPlayerImages() {
    injectStyles();
    Object.entries(window.PRIMETIME_PLAYER_IMAGES || {}).forEach(([slug, fileName]) => {
      setRosterPhoto(slug, fileName);
      setProfilePhoto(slug, fileName);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPlayerImages);
  } else {
    applyPlayerImages();
  }
  window.addEventListener('primetime-player-profile-rendered', applyPlayerImages);
  window.addEventListener('primetime-roster-rendered', applyPlayerImages);
})();
