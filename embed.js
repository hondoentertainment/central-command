/**
 * Embed / Widget mode entry point.
 * Renders a minimal tool grid for use in iframes or standalone widgets.
 *
 * URL params:
 *   ?theme=dark|light   — override theme
 *   ?category=all|comms|ai|...  — filter to a category (case-insensitive)
 *   ?cols=3              — number of grid columns (1-6)
 */

import { loadStoredTools, STORAGE_KEYS } from "./lib/storage.js";
import {
  hydrateTools,
  createFallbackMetadataMap,
  sortTools,
  normalizeUrl,
} from "./lib/tool-model.js";
import { ALL_PRESET_TOOLS, DEFAULT_TOOLS } from "./data/presets.js";
import { getIconMarkup } from "./lib/icons.js";

const fallbackMetadata = createFallbackMetadataMap(ALL_PRESET_TOOLS);

// --- Parse URL params ---
const params = new URLSearchParams(location.search);
const categoryFilter = (params.get("category") || "all").toLowerCase();
const cols = Math.max(1, Math.min(6, parseInt(params.get("cols"), 10) || 3));

// --- DOM refs ---
const grid = document.getElementById("embedGrid");
const template = document.getElementById("embedCardTemplate");

// --- Set columns ---
if (grid) {
  grid.style.setProperty("--embed-cols", String(cols));
}

// --- Accent color map ---
function accentToColor(accent) {
  return (
    {
      amber: "var(--amber)",
      teal: "var(--teal)",
      crimson: "var(--crimson)",
      cobalt: "var(--cobalt)",
    }[accent] ?? "var(--amber)"
  );
}

// --- Load and render ---
function loadTools() {
  return sortTools(
    loadStoredTools(
      (value) => hydrateTools(value, fallbackMetadata),
      DEFAULT_TOOLS
    )
  );
}

function renderGrid() {
  if (!grid || !template) return;

  let tools = loadTools();

  // Apply category filter
  if (categoryFilter && categoryFilter !== "all") {
    tools = tools.filter(
      (tool) => tool.category.toLowerCase() === categoryFilter
    );
  }

  grid.innerHTML = "";

  if (tools.length === 0) {
    const empty = document.createElement("div");
    empty.className = "embed-empty";
    empty.textContent = "No tools found.";
    grid.appendChild(empty);
    return;
  }

  tools.forEach((tool) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".embed-card");
    const icon = fragment.querySelector(".embed-card__icon");
    const category = fragment.querySelector(".embed-card__category");
    const title = fragment.querySelector(".embed-card__title");
    const description = fragment.querySelector(".embed-card__description");
    const launchBtn = fragment.querySelector(".embed-card__launch");

    card.style.setProperty("--accent", accentToColor(tool.accent));
    icon.innerHTML = getIconMarkup(tool);
    category.textContent = tool.category;
    title.textContent = tool.name;
    description.textContent = tool.description;

    const url = normalizeUrl(tool.url);
    launchBtn.href = url;
    launchBtn.setAttribute("aria-label", `Launch ${tool.name}`);

    if (tool.openMode === "same-tab") {
      launchBtn.removeAttribute("target");
    } else {
      launchBtn.target = "_blank";
      launchBtn.rel = "noreferrer";
    }

    // Entire card clickable
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      e.preventDefault();
      if (tool.openMode === "same-tab") {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noreferrer");
      }
    });

    grid.appendChild(fragment);
  });
}

renderGrid();

// Listen for storage changes from the main app
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.tools) {
    renderGrid();
  }
});
