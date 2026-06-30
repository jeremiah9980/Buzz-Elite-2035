import fs from "node:fs";

const [,, csvPath, jsonPath = "cms/content/bombers-site.json"] = process.argv;

if (!csvPath) {
  console.error("Usage: node scripts/import-roster-csv.mjs roster.csv cms/content/bombers-site.json");
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const csv = fs.readFileSync(csvPath, "utf8").trim();

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

const lines = csv.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines.shift()).map(h => h.trim());
const rows = lines.map(line => Object.fromEntries(parseCsvLine(line).map((v, i) => [headers[i], v])));

const players = rows.map((row, idx) => {
  const firstName = row.firstName || row["First Name"] || row.name || `Player ${idx + 1}`;
  const lastInitial = row.lastInitial || row["Last Initial"] || "";
  const jerseyNumber = row.jerseyNumber || row.jersey || row["#"] || "";
  const id = row.id || `${firstName}-${lastInitial || jerseyNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    id,
    jerseyNumber,
    firstName,
    lastInitial,
    displayName: row.displayName || `${firstName}${lastInitial ? " " + lastInitial + "." : ""}`,
    positions: String(row.positions || row.position || "Position TBD").split(/[|;/]/).map(s => s.trim()).filter(Boolean),
    bats: row.bats || "",
    throws: row.throws || "",
    graduationYear: row.graduationYear || "",
    hometown: row.hometown || "",
    photo: row.photo || `assets/players/${id}.jpg`,
    guardianMediaRelease: /^true|yes|1$/i.test(row.guardianMediaRelease || ""),
    profileEnabled: /^true|yes|1$/i.test(row.profileEnabled || ""),
    profileStatus: row.profileStatus || "coming-soon",
    profile: {
      tag: row.tag || "Bombers Athlete",
      oneLine: row.oneLine || "",
      bio: row.bio || "",
      strengths: String(row.strengths || "").split(/[|;]/).map(s => s.trim()).filter(Boolean),
      coachQuote: row.coachQuote || "",
      familyQuote: row.familyQuote || "",
      teammateQuote: row.teammateQuote || "",
      filmUrl: row.filmUrl || "",
      nextStep: row.nextStep || ""
    },
    stats: { avg: "", obp: "", slg: "", ops: "", sb: "", sbPct: "", seasonRows: [] }
  };
});

content.pages.roster.players = players;
content.lastUpdated = new Date().toISOString().slice(0, 10);

fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2));
console.log(`Imported ${players.length} players into ${jsonPath}`);
