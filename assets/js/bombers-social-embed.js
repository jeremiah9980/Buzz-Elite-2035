/**
 * Social embed safety helper.
 * Paste only embed code from official social platforms into the CMS.
 * This helper converts blank embeds into accessible fallback buttons.
 */

window.BombersSocial = {
  renderFallback(container, profileUrl, label) {
    if (!container) return;
    if (container.innerHTML.trim()) return;
    const link = document.createElement("a");
    link.className = "cms-btn";
    link.href = profileUrl || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = label || "Open social profile";
    container.appendChild(link);
  }
};
