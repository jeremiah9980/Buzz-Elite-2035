# Bombers CMS Repo Integration Upgrade

This package is a drop-in upgrade for:

```text
jeremiah9980/bombers
```

It connects the CMS directly to the existing GitHub Pages site structure.

## What This Adds

```text
cms/admin/index.html
cms/admin/app.js
cms/admin/ai-assistant.js
cms/admin/styles.css
cms/content/bombers-site.json
cms/schema/bombers-site.schema.json
cms/workers/ai-content-worker.js
assets/js/bombers-content-renderer.js
assets/js/bombers-social-embed.js
assets/js/bombers-sports-sync.js
assets/css/bombers-cms-managed.css
scripts/validate-bombers-content.mjs
scripts/import-roster-csv.mjs
scripts/import-gamechanger-manual-export.mjs
scripts/import-ncs-manual-export.mjs
scripts/generate-player-pages.mjs
.github/workflows/validate-cms-content.yml
docs/SPEC-2-bombers-cms-repo-integration.md
```

## Install Into the Repo

From your computer:

```bash
git clone https://github.com/jeremiah9980/bombers.git
cd bombers
```

Copy the files from this package into the repo root.

Then commit:

```bash
git add cms assets scripts .github docs README-CMS-UPGRADE.md
git commit -m "Attach Bombers CMS to GitHub Pages site"
git push origin main
```

## Open the CMS

After files are committed, the dashboard path is:

```text
/cms/admin/
```

For GitHub Pages, that usually becomes:

```text
https://jeremiah9980.github.io/bombers/cms/admin/
```

Important: GitHub Pages is static. Do not treat the dashboard as secure by itself. Use it locally, or protect `/cms/admin/` with Cloudflare Access, a private fork/workflow, or another real auth layer.

## Publishing Workflow

1. Open `cms/admin/index.html`.
2. Edit Home, Team Info, Social, GameChanger, NCS, Roster, Player Profiles, Fundraising, and SEO.
3. Click **Validate**.
4. Click **Export for GitHub**.
5. Replace:

```text
cms/content/bombers-site.json
```

6. Commit and push:

```bash
git add cms/content/bombers-site.json
git commit -m "Update Bombers CMS content"
git push
```

## Connect Existing Pages

Add this stylesheet to pages that should render CMS-managed sections:

```html
<link rel="stylesheet" href="assets/css/bombers-cms-managed.css">
```

Add one or more mount points:

```html
<div data-bombers-home></div>
<section data-bombers-team-info></section>
<section data-bombers-social></section>
<section data-bombers-schedule></section>
<section data-bombers-stats></section>
<section data-bombers-ncs></section>
<section data-bombers-roster></section>
<main data-bombers-player-profile></main>
```

Add this script before `</body>`:

```html
<script src="assets/js/bombers-sports-sync.js"></script>
<script src="assets/js/bombers-social-embed.js"></script>
<script src="assets/js/bombers-content-renderer.js"></script>
```

For pages inside a subfolder, set the content path first:

```html
<script>
  window.BOMBERS_CONTENT_URL = "../cms/content/bombers-site.json";
</script>
<script src="../assets/js/bombers-content-renderer.js"></script>
```

## Page-Specific Setup

### Home

Use:

```html
<div data-bombers-home></div>
<section data-bombers-team-info></section>
<section data-bombers-schedule></section>
<section data-bombers-stats></section>
<section data-bombers-social></section>
<section data-bombers-ncs></section>
```

### Roster

Use:

```html
<section data-bombers-roster></section>
```

### Player Profile

Use:

```html
<main data-bombers-player-profile></main>
```

Then open:

```text
player-profile.html?id=player-1
```

You can also generate static player pages:

```bash
node scripts/generate-player-pages.mjs
```

That creates:

```text
players/<player-id>/index.html
```

Only players with both of these set will generate public pages:

```json
"profileEnabled": true,
"guardianMediaRelease": true
```

## Roster CSV Import

Create a CSV like:

```csv
id,jerseyNumber,firstName,lastInitial,displayName,positions,photo,guardianMediaRelease,profileEnabled,oneLine,bio
avery-g,7,Avery,G,Avery G.,P|1B,assets/players/avery-g.jpg,true,true,Power arm and team-first attitude,Approved player bio.
```

Import it:

```bash
node scripts/import-roster-csv.mjs roster.csv cms/content/bombers-site.json
```

## GameChanger Setup

In the CMS, fill in:

```json
"gamechanger": {
  "teamId": "",
  "teamUrl": "",
  "scheduleWidgetUrl": "",
  "calendarIcsUrl": "",
  "statsUrl": ""
}
```

Use public widgets, calendar feeds, or manually approved exports. This package does not bypass GameChanger login or scrape private stats.

Manual schedule CSV import:

```bash
node scripts/import-gamechanger-manual-export.mjs gamechanger-schedule.csv cms/content/bombers-site.json
```

Expected headers:

```csv
date,time,opponent,location,type,status,scoreFor,scoreAgainst,result
```

## NCS Setup

In the CMS, fill in:

```json
"ncs": {
  "teamId": "",
  "teamUrl": ""
}
```

Manual tournament JSON import:

```bash
node scripts/import-ncs-manual-export.mjs ncs-tournaments.json cms/content/bombers-site.json
```

## AI Content Assistant

The dashboard includes a local AI-style drafting helper for:

- Announcements
- Game recaps
- Social captions
- Player bios
- Sponsor thank-yous
- Tournament previews

For real AI generation, deploy:

```text
cms/workers/ai-content-worker.js
```

as a Cloudflare Worker and set this Worker secret:

```text
OPENAI_API_KEY
```

Then paste the Worker URL into the CMS AI endpoint field.

Never put an OpenAI API key directly inside public GitHub Pages JavaScript.

## Validate Before Publishing

```bash
node scripts/validate-bombers-content.mjs cms/content/bombers-site.json
```

The validator blocks common mistakes, especially public player profiles without guardian media release approval.
