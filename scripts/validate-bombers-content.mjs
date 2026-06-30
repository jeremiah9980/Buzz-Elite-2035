import fs from "node:fs";

const path = process.argv[2] || "cms/content/bombers-site.json";
const content = JSON.parse(fs.readFileSync(path, "utf8"));
const issues = [];

function required(value, message) {
  if (value === undefined || value === null || value === "") issues.push(message);
}

required(content.schemaVersion, "schemaVersion is required.");
required(content.site?.teamName, "site.teamName is required.");
required(content.pages?.home?.hero?.title, "pages.home.hero.title is required.");

const players = content.pages?.roster?.players || [];
const ids = new Set();

for (const player of players) {
  required(player.id, `Roster player ${player.displayName || player.jerseyNumber || "(unknown)"} needs an id.`);
  if (ids.has(player.id)) issues.push(`Duplicate player id: ${player.id}`);
  ids.add(player.id);

  if (player.profileEnabled && !player.guardianMediaRelease) {
    issues.push(`${player.displayName || player.id} profile is enabled without guardianMediaRelease=true.`);
  }

  if (player.profileEnabled && player.guardianMediaRelease) {
    required(player.displayName, `${player.id} public profile needs displayName.`);
    required(player.profile?.oneLine, `${player.id} public profile needs profile.oneLine.`);
  }
}

for (const tournament of content.pages?.ncs?.tournaments || []) {
  required(tournament.id, `NCS tournament "${tournament.name || "(unnamed)"}" needs an id.`);
  required(tournament.name, `NCS tournament ${tournament.id || "(unknown)"} needs a name.`);
}

if (issues.length) {
  console.error("Bombers CMS validation failed:\n");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Bombers CMS validation passed. ${players.length} roster player(s) checked.`);
