const GC_WIDGET_ID = 'e408d767-a92e-4c6c-9e20-3af684380a70';
const GC_WIDGET_TARGET = 'gc-schedule-widget-exi1';
const GC_SDK_SRC = 'https://widgets.gc.com/static/js/sdk.v1.js';

function loadGameChangerSdk() {
  return new Promise((resolve, reject) => {
    if (window.GC?.team?.schedule) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${GC_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GC_SDK_SRC;
    script.async = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.body.appendChild(script);
  });
}

async function loadGameChangerScheduleWidget() {
  const container = document.querySelector('[data-gamechanger-schedule]');
  if (!container) return;

  container.removeAttribute('data-gamechanger-schedule');
  container.removeAttribute('data-gamechanger-url');
  container.id = GC_WIDGET_TARGET;
  container.innerHTML = '';
  container.style.minHeight = '280px';
  container.setAttribute('aria-label', 'Buzz Elite GameChanger schedule');

  try {
    await loadGameChangerSdk();

    if (!window.GC?.team?.schedule?.init) {
      throw new Error('GameChanger schedule SDK did not initialize.');
    }

    window.GC.team.schedule.init({
      target: `#${GC_WIDGET_TARGET}`,
      widgetId: GC_WIDGET_ID,
      maxVerticalGamesVisible: 4,
    });
  } catch (error) {
    console.error('Unable to load GameChanger schedule widget', error);
    container.innerHTML = '<p class="gc-schedule-loading">Unable to load the GameChanger schedule right now.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadGameChangerScheduleWidget);
