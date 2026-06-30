(function () {
  const DEFAULT_CONTENT_URL = "/bombers/cms/content/bombers-site.json";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const get = (obj, path) => path.split(".").reduce((acc, part) => acc ? acc[part] : undefined, obj);

  async function loadBombersContent() {
    const script = document.currentScript;
    const contentUrl = script?.dataset?.contentUrl || window.BOMBERS_CONTENT_URL || DEFAULT_CONTENT_URL;
    const response = await fetch(contentUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load Bombers content: ${contentUrl}`);
    const content = await response.json();
    window.BOMBERS_CONTENT = content;
    renderDataBindings(content);
    renderHome(content);
    renderTeamInfo(content);
    renderSocial(content);
    renderSchedule(content);
    renderStats(content);
    renderNcs(content);
    renderRoster(content);
    renderPlayerProfile(content);
    return content;
  }

  function renderDataBindings(content) {
    document.querySelectorAll("[data-bombers-text]").forEach((el) => {
      el.textContent = get(content, el.dataset.bombersText) ?? "";
    });
    document.querySelectorAll("[data-bombers-html]").forEach((el) => {
      el.innerHTML = get(content, el.dataset.bombersHtml) ?? "";
    });
    document.querySelectorAll("[data-bombers-src]").forEach((el) => {
      el.src = get(content, el.dataset.bombersSrc) ?? "";
    });
    document.querySelectorAll("[data-bombers-href]").forEach((el) => {
      el.href = get(content, el.dataset.bombersHref) ?? "#";
    });
  }

  function renderHome(content) {
    const target = document.querySelector("[data-bombers-home]");
    if (!target) return;
    const home = content.pages.home;
    target.innerHTML = `
      <section class="cms-hero">
        <p class="eyebrow">${escapeHtml(home.hero.eyebrow)}</p>
        <h1>${escapeHtml(home.hero.title)}</h1>
        <p class="hero-subtitle">${escapeHtml(home.hero.subtitle)}</p>
        <p>${escapeHtml(home.hero.body)}</p>
        <div class="cms-actions">
          <a class="cms-btn primary" href="${escapeHtml(home.hero.primaryCtaUrl)}">${escapeHtml(home.hero.primaryCtaText)}</a>
          <a class="cms-btn" href="${escapeHtml(home.hero.secondaryCtaUrl)}">${escapeHtml(home.hero.secondaryCtaText)}</a>
        </div>
      </section>
      <section class="cms-card-grid">
        ${(home.featureCards || []).map(card => `
          <a class="cms-card" href="${escapeHtml(card.url)}">
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.body)}</p>
          </a>
        `).join("")}
      </section>
      <section class="cms-panel">
        <h2>Announcements</h2>
        ${(home.announcements || []).filter(a => a.status !== "draft").map(item => `
          <article class="cms-list-item">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.date)}</span>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `).join("")}
      </section>
    `;
  }

  function renderTeamInfo(content) {
    const target = document.querySelector("[data-bombers-team-info]");
    if (!target) return;
    const page = content.pages.teamInfo;
    target.innerHTML = `
      <h2>${escapeHtml(page.headline)}</h2>
      <p>${escapeHtml(page.summary)}</p>
      <p>${escapeHtml(page.mission)}</p>
      <p>${escapeHtml(page.bomberNation)}</p>
      <div class="cms-pill-row">${(page.values || []).map(v => `<span>${escapeHtml(v)}</span>`).join("")}</div>
      <h3>Coaches</h3>
      <div class="cms-card-grid">${(page.coaches || []).map(coach => `
        <article class="cms-card">
          <h3>${escapeHtml(coach.name)}</h3>
          <p><strong>${escapeHtml(coach.role)}</strong></p>
          <p>${escapeHtml(coach.bio)}</p>
        </article>
      `).join("")}</div>
    `;
  }

  function renderSocial(content) {
    const target = document.querySelector("[data-bombers-social]");
    if (!target) return;
    const page = content.pages.social;
    const instagram = page.instagram || {};
    const facebook = page.facebook || {};
    target.innerHTML = `
      <h2>${escapeHtml(page.headline)}</h2>
      <p>${escapeHtml(page.intro)}</p>
      <div class="cms-card-grid">
        <article class="cms-card social-embed">
          <h3>Instagram ${instagram.handle ? "@" + escapeHtml(instagram.handle) : ""}</h3>
          ${instagram.embedHtml || `<a class="cms-btn" href="${escapeHtml(instagram.profileUrl)}" target="_blank" rel="noopener">${escapeHtml(instagram.fallbackText || "Open Instagram")}</a>`}
        </article>
        <article class="cms-card social-embed">
          <h3>${escapeHtml(facebook.pageName || "Facebook")}</h3>
          ${facebook.embedHtml || `<a class="cms-btn" href="${escapeHtml(facebook.profileUrl)}" target="_blank" rel="noopener">${escapeHtml(facebook.fallbackText || "Open Facebook")}</a>`}
        </article>
      </div>
    `;
  }

  function renderSchedule(content) {
    const target = document.querySelector("[data-bombers-schedule]");
    if (!target) return;
    const gc = content.pages.gamechanger;
    target.innerHTML = `
      <div class="cms-panel">
        <h2>GameChanger Schedule</h2>
        <p>${escapeHtml(gc.teamName || "")}</p>
        ${gc.scheduleWidgetUrl ? `<iframe class="cms-embed-frame" src="${escapeHtml(gc.scheduleWidgetUrl)}" loading="lazy"></iframe>` : ""}
        <table class="cms-table">
          <thead><tr><th>Date</th><th>Time</th><th>Opponent</th><th>Location</th><th>Status</th><th>Score</th></tr></thead>
          <tbody>${(gc.schedule || []).map(game => `
            <tr>
              <td>${escapeHtml(game.date)}</td>
              <td>${escapeHtml(game.time)}</td>
              <td>${escapeHtml(game.opponent)}</td>
              <td>${escapeHtml(game.location)}</td>
              <td>${escapeHtml(game.status)}</td>
              <td>${escapeHtml([game.scoreFor, game.scoreAgainst].filter(Boolean).join("-") || game.result || "")}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderStats(content) {
    const target = document.querySelector("[data-bombers-stats]");
    if (!target) return;
    const tables = content.pages.gamechanger.statTables || {};
    const batting = tables.batting || [];
    target.innerHTML = `
      <div class="cms-panel">
        <h2>Player Stats</h2>
        <p>Last sync: ${escapeHtml(content.pages.gamechanger.lastSyncAt || "Manual update pending")}</p>
        ${batting.length ? renderObjectTable(batting) : "<p>No batting stats loaded yet.</p>"}
      </div>
    `;
  }

  function renderNcs(content) {
    const target = document.querySelector("[data-bombers-ncs]");
    if (!target) return;
    const page = content.pages.ncs;
    target.innerHTML = `
      <div class="cms-panel">
        <h2>${escapeHtml(page.dashboardTitle)}</h2>
        <p>Team ID: ${escapeHtml(page.teamId || "Not configured")}</p>
        <div class="cms-card-grid">${(page.tournaments || []).map(tournament => `
          <article class="cms-card">
            <p class="eyebrow">${escapeHtml(tournament.status)}</p>
            <h3>${escapeHtml(tournament.name)}</h3>
            <p>${escapeHtml(tournament.dateRange)} · ${escapeHtml(tournament.location)} · ${escapeHtml(tournament.division)}</p>
            <p><strong>Record:</strong> ${escapeHtml(tournament.record || "TBD")} · <strong>Standing:</strong> ${escapeHtml(tournament.standing || "TBD")}</p>
            ${(tournament.games || []).length ? renderObjectTable(tournament.games) : ""}
          </article>
        `).join("")}</div>
      </div>
    `;
  }

  function renderRoster(content) {
    const target = document.querySelector("[data-bombers-roster]");
    if (!target) return;
    const roster = content.pages.roster;
    target.innerHTML = `
      <section class="cms-panel">
        <h2>${escapeHtml(roster.headline)}</h2>
        <p>${escapeHtml(roster.intro)}</p>
        <div class="cms-roster-grid">${(roster.players || []).map(player => renderPlayerCard(player, roster.defaultCardImage)).join("")}</div>
      </section>
    `;
  }

  function renderPlayerCard(player, defaultImage) {
    const profileLive = player.profileEnabled && player.guardianMediaRelease;
    const url = profileLive ? `player-profile.html?id=${encodeURIComponent(player.id)}` : "#";
    return `
      <article class="cms-player-card">
        <img src="${escapeHtml(player.photo || defaultImage)}" alt="${escapeHtml(player.displayName || player.firstName || "Player")}" loading="lazy" />
        <div>
          <span class="jersey">#${escapeHtml(player.jerseyNumber || "")}</span>
          <h3>${escapeHtml(player.displayName || player.firstName || "Player")}</h3>
          <p>${escapeHtml((player.positions || []).join(" · ") || "Position TBD")}</p>
          <a class="cms-btn ${profileLive ? "primary" : "disabled"}" href="${escapeHtml(url)}">${profileLive ? "View Profile" : "Profile Coming Soon"}</a>
        </div>
      </article>
    `;
  }

  function renderPlayerProfile(content) {
    const target = document.querySelector("[data-bombers-player-profile]");
    if (!target) return;
    const params = new URLSearchParams(window.location.search);
    const id = target.dataset.playerId || params.get("id");
    const player = (content.pages.roster.players || []).find((p) => p.id === id);
    if (!player || !player.profileEnabled || !player.guardianMediaRelease) {
      target.innerHTML = `<section class="cms-panel"><h1>Profile Coming Soon</h1><p>This player profile is not public yet.</p><a class="cms-btn" href="roster.html">Back to Roster</a></section>`;
      return;
    }
    const profile = player.profile || {};
    target.innerHTML = `
      <section class="cms-player-hero">
        <img src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.displayName)}" />
        <div>
          <p class="eyebrow">${escapeHtml(profile.tag || "Bombers Athlete")}</p>
          <h1>#${escapeHtml(player.jerseyNumber)} ${escapeHtml(player.displayName)}</h1>
          <p>${escapeHtml((player.positions || []).join(" · "))}</p>
          <p>${escapeHtml(profile.oneLine || "")}</p>
          ${profile.filmUrl ? `<a class="cms-btn primary" href="${escapeHtml(profile.filmUrl)}">Watch Film</a>` : ""}
        </div>
      </section>
      <section class="cms-card-grid">
        ${["avg","obp","slg","ops","sb","sbPct"].map(k => `<article class="cms-stat"><strong>${escapeHtml(player.stats?.[k] || "—")}</strong><span>${k.toUpperCase()}</span></article>`).join("")}
      </section>
      <section class="cms-panel">
        <h2>Character Profile</h2>
        <p>${escapeHtml(profile.bio || "")}</p>
        ${profile.coachQuote ? `<blockquote>${escapeHtml(profile.coachQuote)}</blockquote>` : ""}
        ${profile.familyQuote ? `<blockquote>${escapeHtml(profile.familyQuote)}</blockquote>` : ""}
        ${profile.teammateQuote ? `<blockquote>${escapeHtml(profile.teammateQuote)}</blockquote>` : ""}
      </section>
      <section class="cms-panel">
        <h2>Season By Season</h2>
        ${renderObjectTable(player.stats?.seasonRows || [])}
      </section>
    `;
  }

  function renderObjectTable(rows) {
    if (!rows || !rows.length) return "";
    const keys = Object.keys(rows[0]);
    return `<table class="cms-table">
      <thead><tr>${keys.map(k => `<th>${escapeHtml(k)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${keys.map(k => `<td>${escapeHtml(row[k])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
  }

  loadBombersContent().catch((error) => {
    console.error(error);
    document.querySelectorAll("[data-bombers-error]").forEach((el) => el.textContent = error.message);
  });
})();
