import fs from "node:fs";

/**
 * Import a manually downloaded/approved GameChanger-style schedule CSV.
 *
 * This script intentionally does not bypass GameChanger login or scrape protected data.
 *
 * Expected CSV headers:
 * date,time,opponent,location,type,status,scoreFor,scoreAgainst,result
 */

const [,, csvPath, jsonPath = "cms/content/bombers-site.json"] = process.argv;
if (!csvPath) {
  console.error("Usage: node scripts/import-gamechanger-manual-export.mjs gamechanger-schedule.csv cms/content/bombers-site.json");
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { values.push(current); current = ""; }
    else current += c;
  }
  values.push(current);
  return values.map(v => v.trim());
}

const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines.shift());
const games = lines.map(line => Object.fromEntries(parseCsvLine(line).map((v, i) => [headers[i], v])));

content.pages.gamechanger.schedule = games;
content.pages.gamechanger.lastSyncAt = new Date().toISOString();
content.lastUpdated = new Date().toISOString().slice(0, 10);

fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2));
console.log(`Imported ${games.length} GameChanger schedule row(s).`);
