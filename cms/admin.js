const ADMIN_PASSWORD = "change-me";
const STORAGE_KEY = "bombers_cms_content_v1";
const CONTENT_URL = "../content/bombers.json";

const sectionMeta = {
  overview: ["Overview", "Manage the Bombers public website content."],
  homepage: ["Homepage", "Update hero content and site branding."],
  announcements: ["Announcements", "Create and edit public news updates."],
  schedule: ["Schedule", "Manage games, events, times, and results."],
  roster: ["Roster", "Manage player names, numbers, positions, and bios."],
  sponsors: ["Sponsors", "Manage sponsor names, links, and logos."],
  gallery: ["Gallery", "Manage public gallery images and alt text."],
  contact: ["Contact", "Update email, phone, address, and social links."],
  seo: ["SEO", "Update metadata used by search engines and social previews."]
};

const fieldSchemas = {
  announcements: [
    ["title", "Title", "input"],
    ["summary", "Summary", "textarea"],
    ["date", "Date", "date"],
    ["status", "Status", "select", ["draft", "published"]]
  ],
  schedule: [
    ["date", "Date", "date"],
    ["time", "Time", "input"],
    ["opponent", "Opponent", "input"],
    ["location", "Location", "input"],
    ["result", "Result", "input"],
    ["status", "Status", "select", ["scheduled", "completed", "cancelled"]]
  ],
  roster: [
    ["name", "Name", "input"],
    ["number", "Number", "input"],
    ["position", "Position", "input"],
    ["bio", "Bio", "textarea"]
  ],
  sponsors: [
    ["name", "Name", "input"],
    ["url", "Website URL", "input"],
    ["logo", "Logo Path", "input"]
  ],
  gallery: [
    ["title", "Title", "input"],
    ["image", "Image Path", "input"],
    ["alt", "Alt Text", "input"]
  ]
};

const blankItems = {
  announcements: () => ({
    id: uniqueId("ann"),
    title: "New Announcement",
    summary: "",
    date: new Date().toISOString().slice(0, 10),
    status: "draft"
  }),
  schedule: () => ({
    id: uniqueId("game"),
    date: new Date().toISOString().slice(0, 10),
    time: "",
    opponent: "",
    location: "",
    result: "",
    status: "scheduled"
  }),
  roster: () => ({
    id: uniqueId("player"),
    name: "New Player",
    number: "",
    position: "",
    bio: ""
  }),
  sponsors: () => ({
    id: uniqueId("sponsor"),
    name: "New Sponsor",
    url: "",
    logo: ""
  }),
  gallery: () => ({
    id: uniqueId("image"),
    title: "New Image",
    image: "",
    alt: ""
  })
};

let state = null;
let activeSection = "overview";

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((acc, key) => {
    if (!acc[key]) acc[key] = {};
    return acc[key];
  }, obj);
  target[last] = value;
}

function updateStatus(message, isSaved = false) {
  const el = qs("#saveStatus");
  el.textContent = message;
  el.parentElement.style.background = isSaved ? "#ecfdf5" : "#fffbeb";
  el.parentElement.style.color = isSaved ? "#166534" : "#92400e";
}

async function loadContent() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      state = JSON.parse(local);
      renderAll();
      updateStatus("Loaded from browser", true);
      return;
    } catch (error) {
      console.warn("Failed to parse browser content", error);
    }
  }

  try {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Content file not found");
    state = await response.json();
  } catch (error) {
    state = getDefaultContent();
    updateStatus("Using default content");
  }

  renderAll();
}

function getDefaultContent() {
  return {
    site: {
      name: "Bombers",
      tagline: "Official Bombers Website",
      primaryColor: "#111827",
      accentColor: "#f59e0b",
      logoText: "BOMBERS"
    },
    homepage: {
      heroTitle: "Welcome to Bombers",
      heroSubtitle: "News, events, roster updates, and highlights from the Bombers.",
      ctaText: "View Schedule",
      ctaUrl: "/schedule",
      heroImage: "/images/bombers-hero.jpg"
    },
    announcements: [],
    schedule: [],
    roster: [],
    sponsors: [],
    gallery: [],
    contact: {
      email: "",
      phone: "",
      address: "",
      facebook: "",
      instagram: "",
      x: "",
      youtube: ""
    },
    seo: {
      metaTitle: "Bombers",
      metaDescription: "Official website for Bombers news, events, roster, sponsors, and updates.",
      ogImage: "/images/bombers-og.jpg"
    },
    updatedAt: new Date().toISOString()
  };
}

function renderAll() {
  bindPathFields();
  renderMetrics();
  renderMiniPreview();
  renderList("announcements");
  renderList("schedule");
  renderList("roster");
  renderList("sponsors");
  renderList("gallery");
}

function bindPathFields() {
  qsa("[data-path]").forEach((field) => {
    const path = field.dataset.path;
    field.value = getByPath(state, path) || "";
    field.oninput = (event) => {
      setByPath(state, path, event.target.value);
      state.updatedAt = new Date().toISOString();
      renderMetrics();
      renderMiniPreview();
      updateStatus("Unsaved changes");
    };
  });
}

function renderMetrics() {
  qs("#announcementCount").textContent = state.announcements?.length || 0;
  qs("#scheduleCount").textContent = state.schedule?.length || 0;
  qs("#rosterCount").textContent = state.roster?.length || 0;
  qs("#galleryCount").textContent = state.gallery?.length || 0;
}

function renderMiniPreview() {
  const hero = state.homepage || {};
  const site = state.site || {};
  qs("#miniPreview").innerHTML = `
    <small>${escapeHtml(site.tagline || "Bombers")}</small>
    <h3>${escapeHtml(hero.heroTitle || "Welcome to Bombers")}</h3>
    <p>${escapeHtml(hero.heroSubtitle || "")}</p>
    <a href="${escapeAttr(hero.ctaUrl || "#")}">${escapeHtml(hero.ctaText || "Learn More")}</a>
  `;
}

function renderList(collection) {
  const container = qs(`#${collection}List`);
  if (!container) return;

  container.innerHTML = "";
  const items = state[collection] || [];
  const schema = fieldSchemas[collection];

  items.forEach((item, index) => {
    const node = qs("#listItemTemplate").content.cloneNode(true);
    const article = node.querySelector(".editor-item");
    const title = node.querySelector(".item-title");
    const fields = node.querySelector(".item-fields");

    title.textContent = item.title || item.name || item.opponent || `${collection} item ${index + 1}`;

    schema.forEach(([key, label, type, options]) => {
      const fieldLabel = document.createElement("label");
      fieldLabel.textContent = label;

      let input;
      if (type === "textarea") {
        input = document.createElement("textarea");
      } else if (type === "select") {
        input = document.createElement("select");
        options.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = type;
      }

      input.value = item[key] || "";
      input.addEventListener("input", () => {
        state[collection][index][key] = input.value;
        state.updatedAt = new Date().toISOString();
        title.textContent = item.title || item.name || item.opponent || `${collection} item ${index + 1}`;
        renderMetrics();
        renderMiniPreview();
        updateStatus("Unsaved changes");
      });

      fieldLabel.appendChild(input);
      fields.appendChild(fieldLabel);
    });

    node.querySelector("[data-remove]").addEventListener("click", () => {
      if (!confirm("Remove this item?")) return;
      state[collection].splice(index, 1);
      state.updatedAt = new Date().toISOString();
      renderList(collection);
      renderMetrics();
      updateStatus("Unsaved changes");
    });

    container.appendChild(node);
  });

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `<p class="muted">No ${collection} yet. Use the add button to create one.</p>`;
    container.appendChild(empty);
  }
}

function saveBrowser() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
  updateStatus("Saved in browser", true);
}

function exportJson() {
  state.updatedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bombers.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateStatus("Exported JSON", true);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      validateContent(imported);
      state = imported;
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
      renderAll();
      updateStatus("Imported JSON", true);
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function validateContent(data) {
  const required = ["site", "homepage", "announcements", "schedule", "roster", "sponsors", "gallery", "contact", "seo"];
  required.forEach((key) => {
    if (!(key in data)) throw new Error(`Missing "${key}" section`);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function showSection(section) {
  activeSection = section;
  qsa(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === section));
  qsa(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.section === section));

  const [title, description] = sectionMeta[section] || sectionMeta.overview;
  qs("#sectionTitle").textContent = title;
  qs("#sectionDescription").textContent = description;
}

function initAuth() {
  const loggedIn = sessionStorage.getItem("bombers_cms_logged_in") === "true";
  if (loggedIn) showApp();

  qs("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const password = qs("#password").value;
    if (password !== ADMIN_PASSWORD) {
      qs("#loginError").textContent = "Incorrect password.";
      return;
    }
    sessionStorage.setItem("bombers_cms_logged_in", "true");
    showApp();
  });

  qs("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("bombers_cms_logged_in");
    qs("#app").classList.add("hidden");
    qs("#loginScreen").classList.remove("hidden");
  });
}

function showApp() {
  qs("#loginScreen").classList.add("hidden");
  qs("#app").classList.remove("hidden");
  if (!state) loadContent();
}

function initEvents() {
  qsa(".nav-link").forEach((link) => {
    link.addEventListener("click", () => showSection(link.dataset.section));
  });

  qsa("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const collection = button.dataset.add;
      state[collection] = state[collection] || [];
      state[collection].push(blankItems[collection]());
      state.updatedAt = new Date().toISOString();
      renderList(collection);
      renderMetrics();
      updateStatus("Unsaved changes");
    });
  });

  qs("#saveBrowserBtn").addEventListener("click", saveBrowser);
  qs("#exportBtn").addEventListener("click", exportJson);

  qs("#importInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importJson(file);
    event.target.value = "";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initEvents();
  showSection("overview");
});
