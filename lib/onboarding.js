/**
 * First-run onboarding experience: guided tooltip tour, workflow wizard, and bookmark import.
 * Shows only on first visit when no tools exist and onboarding has not been completed.
 */
import { PRESET_PACKS } from "../data/presets.js";
import { normalizePinRanks } from "./tool-model.js";

const STORAGE_KEY_COMPLETED = "central-command.onboarding.completed";

// --- Helpers ---

function isOnboardingCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEY_COMPLETED) === "true";
  } catch {
    return false;
  }
}

function markOnboardingCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
  } catch {
    // ignore
  }
}

/**
 * Returns true if the onboarding flow should be shown: no tools and not previously completed.
 * @param {boolean} hasTools - Whether the user has any saved tools
 * @returns {boolean}
 */
export function shouldShowOnboarding(hasTools) {
  return !hasTools && !isOnboardingCompleted();
}

// --- Tooltip Tour ---

const TOUR_STEPS = [
  {
    targetSelector: "#pageNav",
    fallbackSelector: ".content-header",
    title: "Command palette",
    text: "Press Cmd+K to search everything -- tools, pages, runbook notes, and more.",
    arrowPosition: "top",
  },
  {
    targetSelector: "#toolGrid",
    fallbackSelector: ".panel--tools",
    title: "Your command deck",
    text: "Your tools live here. Pin favorites for quick access and drag to reorder.",
    arrowPosition: "top",
  },
  {
    targetSelector: "#searchInput",
    fallbackSelector: ".panel__header-actions--tools",
    title: "Keyboard shortcuts",
    text: "Assign Ctrl+letter shortcuts to pinned tools for instant launches.",
    arrowPosition: "top",
  },
  {
    targetSelector: "#pageNav",
    fallbackSelector: ".content-header",
    title: "Explore everything",
    text: "Explore categories, tasks, and your daily runbook from the navigation.",
    arrowPosition: "top",
  },
];

function getTargetElement(step) {
  return (
    document.querySelector(step.targetSelector) ||
    document.querySelector(step.fallbackSelector)
  );
}

function positionTooltip(tooltip, arrow, target, arrowPosition) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  let top, left;

  if (arrowPosition === "top") {
    // Tooltip below target
    top = rect.bottom + scrollY + 14;
    left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2;
  } else if (arrowPosition === "bottom") {
    // Tooltip above target
    top = rect.top + scrollY - tooltipRect.height - 14;
    left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2;
  } else if (arrowPosition === "left") {
    // Tooltip to the right
    top = rect.top + scrollY + rect.height / 2 - tooltipRect.height / 2;
    left = rect.right + scrollX + 14;
  } else {
    // Tooltip to the left
    top = rect.top + scrollY + rect.height / 2 - tooltipRect.height / 2;
    left = rect.left + scrollX - tooltipRect.width - 14;
  }

  // Clamp to viewport
  const vw = document.documentElement.clientWidth;
  const pad = 12;
  if (left < pad) left = pad;
  if (left + tooltipRect.width > vw - pad) left = vw - tooltipRect.width - pad;
  if (top < scrollY + pad) top = scrollY + pad;

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  // Position arrow to point at target center
  arrow.className = `onboarding-tooltip__arrow onboarding-tooltip__arrow--${arrowPosition}`;
  if (arrowPosition === "top" || arrowPosition === "bottom") {
    const arrowLeft = rect.left + scrollX + rect.width / 2 - left;
    arrow.style.left = `${Math.max(20, Math.min(arrowLeft, tooltipRect.width - 20))}px`;
    arrow.style.top = "";
  } else {
    const arrowTop = rect.top + scrollY + rect.height / 2 - top;
    arrow.style.top = `${Math.max(20, Math.min(arrowTop, tooltipRect.height - 20))}px`;
    arrow.style.left = "";
  }
}

function createSpotlight(target) {
  const overlay = document.createElement("div");
  overlay.className = "onboarding-overlay";

  const spotlight = document.createElement("div");
  spotlight.className = "onboarding-spotlight";

  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const padding = 8;

  spotlight.style.top = `${rect.top + scrollY - padding}px`;
  spotlight.style.left = `${rect.left + scrollX - padding}px`;
  spotlight.style.width = `${rect.width + padding * 2}px`;
  spotlight.style.height = `${rect.height + padding * 2}px`;

  overlay.appendChild(spotlight);
  return overlay;
}

function runTour() {
  return new Promise((resolve) => {
    let currentStep = 0;
    let overlay = null;
    let tooltip = null;
    let activeEscHandler = null;

    function cleanup() {
      overlay?.remove();
      tooltip?.remove();
      overlay = null;
      tooltip = null;
      if (activeEscHandler) {
        document.removeEventListener("keydown", activeEscHandler);
        activeEscHandler = null;
      }
      document.body.style.overflow = "";
    }

    function finish(skipped) {
      cleanup();
      resolve(skipped ? "skipped" : "completed");
    }

    function showStep(index) {
      cleanup();

      if (index >= TOUR_STEPS.length) {
        finish(false);
        return;
      }

      currentStep = index;
      const step = TOUR_STEPS[currentStep];
      const target = getTargetElement(step);

      if (!target) {
        // Skip this step if target not found
        showStep(index + 1);
        return;
      }

      // Scroll target into view
      target.scrollIntoView({ behavior: "smooth", block: "center" });

      // Create spotlight overlay
      overlay = createSpotlight(target);
      document.body.appendChild(overlay);
      document.body.style.overflow = "";

      // Create tooltip
      tooltip = document.createElement("div");
      tooltip.className = "onboarding-tooltip";
      tooltip.setAttribute("role", "dialog");
      tooltip.setAttribute("aria-label", `Tour step ${currentStep + 1} of ${TOUR_STEPS.length}`);

      const arrow = document.createElement("div");
      arrow.className = "onboarding-tooltip__arrow";

      const counter = document.createElement("span");
      counter.className = "onboarding-tooltip__counter";
      counter.textContent = `${currentStep + 1}/${TOUR_STEPS.length}`;

      const title = document.createElement("strong");
      title.className = "onboarding-tooltip__title";
      title.textContent = step.title;

      const text = document.createElement("p");
      text.className = "onboarding-tooltip__text";
      text.textContent = step.text;

      const actions = document.createElement("div");
      actions.className = "onboarding-tooltip__actions";

      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "ghost-button onboarding-tooltip__skip";
      skipBtn.textContent = "Skip tour";
      skipBtn.addEventListener("click", () => finish(true));

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "primary-button onboarding-tooltip__next";
      nextBtn.textContent = currentStep < TOUR_STEPS.length - 1 ? "Next" : "Done";
      nextBtn.addEventListener("click", () => showStep(currentStep + 1));

      actions.append(skipBtn, nextBtn);
      tooltip.append(arrow, counter, title, text, actions);
      document.body.appendChild(tooltip);

      // Position after render
      requestAnimationFrame(() => {
        positionTooltip(tooltip, arrow, target, step.arrowPosition);
        nextBtn.focus();
      });

      // Click on overlay dismisses (skip)
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) finish(true);
      });

      // Escape key to skip
      activeEscHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(true);
        }
      };
      document.addEventListener("keydown", activeEscHandler);
    }

    showStep(0);
  });
}

// --- Workflow Wizard ---

function parseBookmarkHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const anchors = doc.querySelectorAll("a[href]");
  const bookmarks = [];
  const seen = new Set();

  anchors.forEach((a) => {
    const url = a.getAttribute("href") || "";
    const name = (a.textContent || "").trim();
    if (!url || !name || seen.has(url)) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    seen.add(url);
    bookmarks.push({ name, url });
  });

  return bookmarks;
}

function bookmarkToTool(bookmark) {
  let category = "Personal";
  try {
    const u = new URL(bookmark.url);
    const h = u.hostname.toLowerCase();
    if (h.includes("github") || h.includes("gitlab") || h.includes("vercel") || h.includes("netlify")) category = "Build";
    else if (h.includes("slack") || h.includes("mail") || h.includes("zoom") || h.includes("teams")) category = "Comms";
    else if (h.includes("notion") || h.includes("drive") || h.includes("dropbox")) category = "Workspace";
    else if (h.includes("chatgpt") || h.includes("claude") || h.includes("gemini") || h.includes("openai")) category = "AI";
    else if (h.includes("docs.google") || h.includes("medium") || h.includes("substack")) category = "Writing";
  } catch {
    // fallback stays "Personal"
  }

  return {
    id: crypto.randomUUID(),
    name: bookmark.name.slice(0, 80),
    url: bookmark.url,
    category,
    description: "",
    accent: "amber",
    pinned: false,
    pinRank: null,
    surfaces: [],
    iconKey: "auto",
    shortcutLabel: "",
    openMode: "new-tab",
  };
}

function showWorkflowWizard(onComplete) {
  const selectedPackIds = new Set();
  let importedBookmarks = [];
  let dismissed = false;

  function dismiss(result) {
    if (dismissed) return;
    dismissed = true;
    overlay.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleEsc);
    markOnboardingCompleted();
    onComplete(result);
  }

  function handleEsc(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss({ tools: [], source: "scratch" });
    }
  }

  const overlay = document.createElement("div");
  overlay.className = "workflow-wizard-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Choose your workflow");

  const modal = document.createElement("div");
  modal.className = "workflow-wizard";

  // Header
  const header = document.createElement("div");
  header.className = "workflow-wizard__header";
  header.innerHTML = `
    <p class="eyebrow">Get Started</p>
    <h2 class="workflow-wizard__title">Choose your workflow</h2>
    <p class="workflow-wizard__subtitle">Pick one or more starter packs to populate your deck, or start fresh.</p>
  `;

  // Pack cards container
  const packGrid = document.createElement("div");
  packGrid.className = "workflow-wizard__grid";

  PRESET_PACKS.forEach((pack) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "workflow-wizard__card";
    card.setAttribute("data-pack-id", pack.id);
    card.setAttribute("aria-pressed", "false");

    card.innerHTML = `
      <div class="workflow-wizard__card-check" aria-hidden="true"></div>
      <strong class="workflow-wizard__card-title">${escapeHtml(pack.title)}</strong>
      <p class="workflow-wizard__card-desc">${escapeHtml(pack.description)}</p>
      <span class="workflow-wizard__card-meta">${pack.tools.length} tools</span>
    `;

    card.addEventListener("click", () => {
      if (selectedPackIds.has(pack.id)) {
        selectedPackIds.delete(pack.id);
        card.classList.remove("workflow-wizard__card--selected");
        card.setAttribute("aria-pressed", "false");
      } else {
        selectedPackIds.add(pack.id);
        card.classList.add("workflow-wizard__card--selected");
        card.setAttribute("aria-pressed", "true");
      }
      updateSetupBtn();
    });

    packGrid.appendChild(card);
  });

  // Bookmark import section
  const importSection = document.createElement("div");
  importSection.className = "workflow-wizard__import";

  const importLabel = document.createElement("label");
  importLabel.className = "workflow-wizard__import-label";
  importLabel.innerHTML = `
    <span class="workflow-wizard__import-icon" aria-hidden="true">&#128278;</span>
    Import from bookmarks
  `;

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = ".html,.htm";
  importInput.hidden = true;

  const importStatus = document.createElement("p");
  importStatus.className = "workflow-wizard__import-status";
  importStatus.setAttribute("role", "status");
  importStatus.setAttribute("aria-live", "polite");

  importLabel.addEventListener("click", () => importInput.click());
  importLabel.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      importInput.click();
    }
  });
  importLabel.setAttribute("tabindex", "0");
  importLabel.setAttribute("role", "button");

  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bookmarks = parseBookmarkHtml(reader.result);
      importedBookmarks = bookmarks;
      if (bookmarks.length === 0) {
        importStatus.textContent = "No bookmarks found in this file.";
      } else {
        importStatus.textContent = `Found ${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"} ready to import.`;
      }
      updateSetupBtn();
    };
    reader.onerror = () => {
      importStatus.textContent = "Could not read the file. Try again.";
    };
    reader.readAsText(file);
  });

  importSection.append(importLabel, importInput, importStatus);

  // Actions
  const actions = document.createElement("div");
  actions.className = "workflow-wizard__actions";

  const scratchBtn = document.createElement("button");
  scratchBtn.type = "button";
  scratchBtn.className = "ghost-button workflow-wizard__scratch";
  scratchBtn.textContent = "Start from scratch";
  scratchBtn.addEventListener("click", () => {
    dismiss({ tools: [], source: "scratch" });
  });

  const setupBtn = document.createElement("button");
  setupBtn.type = "button";
  setupBtn.className = "primary-button workflow-wizard__setup";
  setupBtn.textContent = "Set up my deck";
  setupBtn.disabled = true;

  function updateSetupBtn() {
    const hasSelection = selectedPackIds.size > 0 || importedBookmarks.length > 0;
    setupBtn.disabled = !hasSelection;
    if (selectedPackIds.size > 0 && importedBookmarks.length > 0) {
      setupBtn.textContent = `Set up my deck (${selectedPackIds.size} pack${selectedPackIds.size === 1 ? "" : "s"} + ${importedBookmarks.length} bookmark${importedBookmarks.length === 1 ? "" : "s"})`;
    } else if (selectedPackIds.size > 0) {
      setupBtn.textContent = `Set up my deck (${selectedPackIds.size} pack${selectedPackIds.size === 1 ? "" : "s"})`;
    } else if (importedBookmarks.length > 0) {
      setupBtn.textContent = `Set up my deck (${importedBookmarks.length} bookmark${importedBookmarks.length === 1 ? "" : "s"})`;
    } else {
      setupBtn.textContent = "Set up my deck";
    }
  }

  setupBtn.addEventListener("click", () => {
    // Merge tools from selected packs, deduplicating by URL
    const seenUrls = new Set();
    let mergedTools = [];

    for (const packId of selectedPackIds) {
      const pack = PRESET_PACKS.find((p) => p.id === packId);
      if (!pack) continue;
      for (const tool of pack.tools) {
        const normUrl = tool.url.toLowerCase().replace(/\/+$/, "");
        if (!seenUrls.has(normUrl)) {
          seenUrls.add(normUrl);
          mergedTools.push(structuredClone(tool));
        }
      }
    }

    // Add imported bookmarks
    for (const bm of importedBookmarks) {
      const normUrl = bm.url.toLowerCase().replace(/\/+$/, "");
      if (!seenUrls.has(normUrl)) {
        seenUrls.add(normUrl);
        mergedTools.push(bookmarkToTool(bm));
      }
    }

    mergedTools = normalizePinRanks(mergedTools);

    dismiss({ tools: mergedTools, source: "wizard" });
  });

  actions.append(scratchBtn, setupBtn);

  modal.append(header, packGrid, importSection, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Focus the first pack card
  requestAnimationFrame(() => {
    const firstCard = packGrid.querySelector(".workflow-wizard__card");
    firstCard?.focus();
  });

  document.addEventListener("keydown", handleEsc);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// --- Public API ---

/**
 * Starts the full onboarding flow: tooltip tour then workflow wizard.
 * Returns a promise that resolves with the tools the user chose (may be empty).
 * @param {Object} [opts]
 * @param {(result: {tools: Array, source: string}) => void} [opts.onComplete] - Called when wizard finishes
 * @returns {Promise<{tools: Array, source: string}>}
 */
export async function startOnboarding({ onComplete } = {}) {
  // Run the tooltip tour first
  await runTour();

  // Then show the workflow wizard
  return new Promise((resolve) => {
    showWorkflowWizard((result) => {
      onComplete?.(result);
      resolve(result);
    });
  });
}
