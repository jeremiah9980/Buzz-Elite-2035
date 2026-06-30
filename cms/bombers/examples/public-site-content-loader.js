/**
 * Bombers public-site content loader.
 *
 * Use this on public pages to render content from:
 * /bombers/content/bombers.json
 */

async function loadBombersContent() {
  const response = await fetch("/bombers/content/bombers.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load Bombers content");
  return response.json();
}

function text(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "";
}

function attr(selector, name, value) {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute(name, value);
}

function renderBombersHomepage(content) {
  text("[data-bombers='heroTitle']", content.homepage.heroTitle);
  text("[data-bombers='heroSubtitle']", content.homepage.heroSubtitle);
  text("[data-bombers='ctaText']", content.homepage.ctaText);
  attr("[data-bombers='ctaLink']", "href", content.homepage.ctaUrl);
  attr("[data-bombers='heroImage']", "src", content.homepage.heroImage);
  attr("[data-bombers='heroImage']", "alt", content.homepage.heroTitle);

  const announcements = document.querySelector("[data-bombers='announcements']");
  if (announcements) {
    announcements.innerHTML = "";
    content.announcements
      .filter((item) => item.status === "published")
      .forEach((item) => {
        const article = document.createElement("article");
        article.innerHTML = `
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <time>${escapeHtml(item.date)}</time>
        `;
        announcements.appendChild(article);
      });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const content = await loadBombersContent();
    renderBombersHomepage(content);
  } catch (error) {
    console.error(error);
  }
});
