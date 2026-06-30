import fs from "node:fs";

/**
 * Import a manually curated NCS tournament JSON file into Bombers CMS content.
 *
 * Expected JSON:
 * [
 *   {
 *     "id": "event-id",
 *     "name": "Tournament Name",
 *     "dateRange": "2026-07-04",
 *     "location": "Texas",
 *     "division": "10U",
 *     "status": "upcoming",
 *     "record": "0-0",
 *     "standing": "TBD",
 *     "eventUrl": "",
 *     "games": []
 *   }
 * ]
 */

const [,, tournamentsPath, jsonPath = "cms/content/bombers-site.json"] = process.argv;
if (!tournamentsPath) {
  console.error("Usage: node scripts/import-ncs-manual-export.mjs ncs-tournaments.json cms/content/bombers-site.json");
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const tournaments = JSON.parse(fs.readFileSync(tournamentsPath, "utf8"));

if (!Array.isArray(tournaments)) {
  console.error("NCS import file must be an array.");
  process.exit(1);
}

content.pages.ncs.tournaments = tournaments;
content.pages.ncs.lastSyncAt = new Date().toISOString();
content.lastUpdated = new Date().toISOString().slice(0, 10);

fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2));
console.log(`Imported ${tournaments.length} NCS tournament(s).`);
