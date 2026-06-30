const CONTENT_URL = "../content/bombers-site.json";
const LOCAL_KEY = "bombers-cms-draft-v2";

const sections = [
  { id: "site", title: "Site Settings", path: "site" },
  { id: "home", title: "Home Page", path: "pages.home" },
  { id: "teamInfo", title: "Bombers Team Information", path: "pages.teamInfo" },
  { id: "social", title: "Social Media Embedded Sections", path: "pages.social" },
  { id: "gamechanger", title: "GameChanger Schedule & Stats", path: "pages.gamechanger" },
  { id: "ncs", title: "NCS Tournament Tracker", path: "pages.ncs" },
  { id: "roster", title: "Roster", path: "pages.roster" },
  { id: "fundraising", title: "Fundraising & Sponsors", path: "pages.fundraising" },
  { id: "seo", title: "SEO", path: "seo" }
];

let content = {};
let activeSection = "home";

const $ = (id) => document.getElementById(id);

function deepGet(obj, path) {
  return path.split(".").reduce((acc, key) => acc ? acc[key] : undefined, obj);
}

function deepSet(obj, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  let ref = obj;
  for (const part of parts) {
    if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
    ref = ref[part];
  }
  ref[last] = value;
}

function humanize(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function toast(message, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function isTextareaKey(key, value) {
  return /body|summary|intro|mission|notes|description|bio|quote|embedHtml|syncNotes|oneLine/i.test(key) || String(value || "").length > 90;
}

function createField(key, value, path) {
  if (Array.isArray(value)) return createArrayField(key, value, path);

  if (value && typeof value === "object") {
    const fs = document.createElement("fieldset");
    fs.className = "fieldset";
    const legend = document.createElement("legend");
    legend.textContent = humanize(key);
    fs.appendChild(legend);
    Object.entries(value).forEach(([childKey, childValue]) => {
      fs.appendChild(createField(childKey, childValue, `${path}.${childKey}`));
    });
    return fs;
  }

  if (typeof value === "boolean") {
    const wrap = document.createElement("label");
    wrap.className = "checkbox-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => {
      deepSet(content, path, input.checked);
      refresh();
    });
    const span = document.createElement("span");
    span.textContent = humanize(key);
    wrap.append(input, span);
    return wrap;
  }

  const label = document.createElement("label");
  label.textContent = humanize(key);

  const input = isTextareaKey(key, value) ? document.createElement("textarea") : document.createElement("input");
  if (input.tagName === "TEXTAREA") input.rows = /embedHtml/i.test(key) ? 7 : 3;
  input.value = value ?? "";
  input.placeholder = humanize(key);
  input.addEventListener("input", () => {
    deepSet(content, path, input.value);
    refreshPreviewOnly();
  });
  label.appendChild(input);
  return label;
}

function createArrayField(key, arr, path) {
  const wrapper = document.createElement("div");
  wrapper.className = "fieldset";

  const tools = document.createElement("div");
  tools.className = "array-tools";
  const title = document.createElement("strong");
  title.textContent = humanize(key);
  const add = document.createElement("button");
  add.className = "btn ghost small";
  add.type = "button";
  add.textContent = `Add ${humanize(key).replace(/s$/, "")}`;
  add.addEventListener("click", () => {
    const current = deepGet(content, path) || [];
    const sample = current[0];
    current.push(cloneEmpty(sample));
    deepSet(content, path, current);
    renderSection();
    refresh();
  });
  tools.append(title, add);
  wrapper.appendChild(tools);

  arr.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = "array-item";
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.entries(item).forEach(([childKey, childValue]) => {
        itemEl.appendChild(createField(childKey, childValue, `${path}.${index}.${childKey}`));
      });
    } else {
      itemEl.appendChild(createField(index, item, `${path}.${index}`));
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn danger small";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      const current = deepGet(content, path) || [];
      current.splice(index, 1);
      deepSet(content, path, current);
      renderSection();
      refresh();
    });
    itemEl.appendChild(remove);
    wrapper.appendChild(itemEl);
  });

  return wrapper;
}

function cloneEmpty(sample) {
  if (!sample || typeof sample !== "object") return "";
  if (Array.isArray(sample)) return [];
  return Object.fromEntries(Object.entries(sample).map(([key, value]) => {
    if (Array.isArray(value)) return [key, []];
    if (typeof value === "boolean") return [key, false];
    if (value && typeof value === "object") return [key, cloneEmpty(value)];
    return [key, ""];
  }));
}

function renderNav() {
  const nav = $("sectionNav");
  nav.innerHTML = "";
  sections.forEach((section) => {
    const btn = document.createElement("button");
    btn.className = `nav-btn ${section.id === activeSection ? "active" : ""}`;
    btn.textContent = section.title;
    btn.addEventListener("click", () => {
      activeSection = section.id;
      renderNav();
      renderSection();
    });
    nav.appendChild(btn);
  });
}

function renderSection() {
  const section = sections.find((s) => s.id === activeSection) || sections[0];
  $("sectionTitle").textContent = section.title;
  const data = deepGet(content, section.path);
  const root = $("formRoot");
  root.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "form-grid";
  Object.entries(data || {}).forEach(([key, value]) => {
    grid.appendChild(createField(key, value, `${section.path}.${key}`));
  });
  root.appendChild(grid);
  refreshPreviewOnly();
}

function refresh() {
  content.lastUpdated = new Date().toISOString().slice(0, 10);
  refreshPreviewOnly();
}

function refreshPreviewOnly() {
  $("jsonPreview").textContent = JSON.stringify(content, null, 2);
  $("lastUpdated").textContent = content.lastUpdated || "—";
  const players = content.pages?.roster?.players || [];
  $("playerCount").textContent = players.length;
  $("profileCount").textContent = players.filter((p) => p.profileEnabled && p.guardianMediaRelease).length;
}

function validateContent() {
  const issues = [];
  if (!content.site?.teamName) issues.push("Missing site.teamName");
  if (!content.pages?.home?.hero?.title) issues.push("Missing home hero title");
  const players = content.pages?.roster?.players || [];
  const ids = new Set();
  players.forEach((p, index) => {
    if (!p.id) issues.push(`Player ${index + 1} is missing id`);
    if (ids.has(p.id)) issues.push(`Duplicate player id: ${p.id}`);
    ids.add(p.id);
    if (p.profileEnabled && !p.guardianMediaRelease) {
      issues.push(`${p.displayName || p.id} has profileEnabled=true but guardianMediaRelease=false`);
    }
  });
  if (!content.pages?.gamechanger?.teamId) issues.push("GameChanger teamId is blank. This is okay until you have the ID.");
  if (!content.pages?.ncs?.teamId) issues.push("NCS teamId is blank. This is okay until you have the ID.");

  toast(issues.length ? `Validation found ${issues.length} item(s). See console.` : "Validation passed.");
  if (issues.length) console.warn("Bombers CMS validation issues:", issues);
}

async function loadContent({ preferLocal = true } = {}) {
  const local = localStorage.getItem(LOCAL_KEY);
  if (preferLocal && local) {
    content = JSON.parse(local);
    toast("Loaded saved browser draft.");
  } else {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${CONTENT_URL}`);
    content = await response.json();
    toast("Loaded repo JSON.");
  }
  renderNav();
  renderSection();
  refreshPreviewOnly();
}

function saveLocal() {
  refresh();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(content, null, 2));
  toast("Draft saved in this browser.");
}

function exportJson() {
  refresh();
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bombers-site.json";
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Exported bombers-site.json. Commit it to cms/content/.");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    content = JSON.parse(reader.result);
    saveLocal();
    renderSection();
    refreshPreviewOnly();
    toast("Imported JSON.");
  };
  reader.readAsText(file);
}

async function generateDraft() {
  const text = await window.BombersAI.draft({
    type: $("aiContentType").value,
    facts: $("aiFacts").value,
    tone: $("aiTone").value,
    endpoint: $("aiEndpoint").value,
    context: {
      teamName: content.site?.teamName,
      season: content.site?.season,
      activeSection
    }
  });
  $("aiOutput").value = text;
}

function polishCurrentSection() {
  const section = sections.find((s) => s.id === activeSection);
  const selected = deepGet(content, section.path);
  const text = typeof selected === "string" ? selected : JSON.stringify(selected, null, 2);
  $("aiOutput").value = window.BombersAI.polish({ text, tone: $("aiTone").value });
}

$("loadRepoContentBtn").addEventListener("click", () => loadContent({ preferLocal: false }));
$("saveLocalBtn").addEventListener("click", saveLocal);
$("exportBtn").addEventListener("click", exportJson);
$("validateBtn").addEventListener("click", validateContent);
$("copyJsonBtn").addEventListener("click", () => navigator.clipboard.writeText(JSON.stringify(content, null, 2)).then(() => toast("JSON copied.")));
$("copyAiBtn").addEventListener("click", () => navigator.clipboard.writeText($("aiOutput").value).then(() => toast("Draft copied.")));
$("aiDraftBtn").addEventListener("click", generateDraft);
$("aiPolishBtn").addEventListener("click", polishCurrentSection);
$("importFile").addEventListener("change", (event) => event.target.files[0] && importJson(event.target.files[0]));

loadContent().catch((error) => {
  console.error(error);
  toast("Could not load repo JSON. Import a JSON file or check path.", "error");
});
