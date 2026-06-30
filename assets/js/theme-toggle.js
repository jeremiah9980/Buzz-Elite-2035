// Buzz Elite 2035 dark/light theme toggle
(function () {
  const STORAGE_KEY = 'buzz-elite-2035-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function normalizeTheme(value) {
    return value === LIGHT ? LIGHT : DARK;
  }

  function getStoredTheme() {
    try { return normalizeTheme(localStorage.getItem(STORAGE_KEY)); }
    catch (err) { return DARK; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); }
    catch (err) { /* localStorage may be blocked */ }
  }

  function applyTheme(theme, shouldSave) {
    const nextTheme = normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (document.body) document.body.setAttribute('data-theme', nextTheme);
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      const isLight = nextTheme === LIGHT;
      button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      button.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      button.dataset.themeState = nextTheme;
      button.innerHTML = `<i class="ti ${isLight ? 'ti-moon' : 'ti-sun'}"></i><span class="theme-toggle-label">${isLight ? 'Dark' : 'Light'}</span>`;
    });
    if (shouldSave) saveTheme(nextTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    applyTheme(current === LIGHT ? DARK : LIGHT, true);
  }

  function bindButtons() {
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', toggleTheme);
    });
    applyTheme(document.documentElement.getAttribute('data-theme') || getStoredTheme(), false);
  }

  window.BuzzTheme = { applyTheme, toggleTheme, getTheme: getStoredTheme };

  applyTheme(getStoredTheme(), false);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }
})();
