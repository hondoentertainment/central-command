/**
 * Central Command New Tab extension page.
 *
 * Loads tools from chrome.storage.local (synced from main app) or falls back
 * to rendering an iframe of the deployed embed view.
 */

(function () {
  // --- Configuration ---
  // Set this to your deployed Central Command URL
  const DEPLOYED_URL = "https://central-command.vercel.app";

  const contentEl = document.getElementById("content");
  const openAppLink = document.getElementById("openAppLink");

  if (openAppLink) {
    openAppLink.href = DEPLOYED_URL;
  }

  // --- Try chrome.storage.local first ---
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["central-command.tools.v2"], (result) => {
      const raw = result["central-command.tools.v2"];
      if (raw) {
        try {
          const tools = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (Array.isArray(tools) && tools.length > 0) {
            renderLocalTools(tools);
            return;
          }
        } catch (err) {
          console.warn("[Central Command Extension] Failed to parse stored tools:", err);
        }
      }
      // Fall back to iframe
      renderIframe();
    });
  } else {
    // Not in a Chrome extension context, use iframe
    renderIframe();
  }

  /**
   * Render tools from chrome.storage.local as simple cards.
   */
  function renderLocalTools(tools) {
    if (!contentEl) return;

    const grid = document.createElement("div");
    grid.id = "toolGrid";

    // Sort: pinned first, then alphabetical
    const sorted = tools
      .filter((t) => t && t.name && t.url)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        return (a.name || "").localeCompare(b.name || "");
      });

    if (sorted.length === 0) {
      renderIframe();
      return;
    }

    sorted.forEach((tool) => {
      const card = document.createElement("div");
      card.className = "newtab-card";
      card.setAttribute("role", "link");
      card.setAttribute("tabindex", "0");

      const name = document.createElement("div");
      name.className = "newtab-card__name";
      name.textContent = tool.name;

      const category = document.createElement("div");
      category.className = "newtab-card__category";
      category.textContent = tool.category || "";

      card.appendChild(name);
      card.appendChild(category);

      const url = normalizeUrl(tool.url);
      card.addEventListener("click", () => {
        if (tool.openMode === "same-tab") {
          window.location.href = url;
        } else {
          window.open(url, "_blank", "noreferrer");
        }
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });

      grid.appendChild(card);
    });

    contentEl.appendChild(grid);
  }

  /**
   * Render the embed view in a full-page iframe.
   */
  function renderIframe() {
    if (!contentEl) return;

    const iframe = document.createElement("iframe");
    iframe.id = "newtabFrame";
    iframe.src = `${DEPLOYED_URL}/embed?theme=dark&cols=4`;
    iframe.style.flex = "1";
    iframe.style.border = "none";
    iframe.style.width = "100%";
    iframe.setAttribute("title", "Central Command tools");

    contentEl.appendChild(iframe);
  }

  /**
   * Basic URL normalizer (mirrors tool-model.js logic).
   */
  function normalizeUrl(value) {
    const candidate = (value || "").trim();
    if (/^https?:\/\//i.test(candidate) || /^file:\/\//i.test(candidate)) return candidate;
    if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(candidate)) return candidate;
    return "https://" + candidate;
  }
})();
