import fs from "node:fs";
import path from "node:path";

const jsonPath = process.argv[2] || "cms/content/bombers-site.json";
const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const players = content.pages?.roster?.players || [];

const outRoot = "players";
fs.mkdirSync(outRoot, { recursive: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let count = 0;

for (const player of players) {
  if (!player.profileEnabled || !player.guardianMediaRelease) continue;
  const dir = path.join(outRoot, player.id);
  fs.mkdirSync(dir, { recursive: true });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>#${escapeHtml(player.jerseyNumber)} ${escapeHtml(player.displayName)} — Bombers Fastpitch</title>
  <link rel="stylesheet" href="../../assets/css/bombers-cms-managed.css" />
</head>
<body>
  <main data-bombers-player-profile data-player-id="${escapeHtml(player.id)}"></main>
  <script>
    window.BOMBERS_CONTENT_URL = "../../cms/content/bombers-site.json";
  </script>
  <script src="../../assets/js/bombers-content-renderer.js"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(dir, "index.html"), html);
  count++;
}

console.log(`Generated ${count} public player profile page(s) in ${outRoot}/`);
