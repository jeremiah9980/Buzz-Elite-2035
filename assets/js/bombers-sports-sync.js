/**
 * Bombers sports sync helpers.
 *
 * GitHub Pages is static, so this file does not bypass third-party login or scrape protected pages.
 * Use it to render already-approved public/manual data from cms/content/bombers-site.json.
 */

window.BombersSportsSync = {
  buildGameChangerEmbed(team) {
    if (!team) return "";
    if (team.scheduleWidgetUrl) {
      return `<iframe class="cms-embed-frame" src="${team.scheduleWidgetUrl}" loading="lazy" title="GameChanger schedule"></iframe>`;
    }
    if (team.calendarIcsUrl) {
      return `<p><a href="${team.calendarIcsUrl}">Subscribe to GameChanger calendar</a></p>`;
    }
    return `<p>Add a GameChanger team ID, public team URL, schedule widget URL, or calendar feed in the CMS.</p>`;
  },

  normalizeGameResult(game) {
    const forScore = Number(game.scoreFor);
    const againstScore = Number(game.scoreAgainst);
    if (Number.isNaN(forScore) || Number.isNaN(againstScore)) return "";
    if (forScore > againstScore) return "W";
    if (forScore < againstScore) return "L";
    return "T";
  },

  calculateTournamentRecord(games = []) {
    return games.reduce((acc, game) => {
      const result = game.result || this.normalizeGameResult(game);
      if (result === "W") acc.w++;
      else if (result === "L") acc.l++;
      else if (result === "T") acc.t++;
      return acc;
    }, { w: 0, l: 0, t: 0 });
  }
};
