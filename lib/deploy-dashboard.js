import { renderNav } from "./nav.js";
import {
  DEPLOY_GUIDANCE,
  DEPLOY_PROJECTS,
  DUPLICATE_FOLDERS,
  GITHUB_ORG_URL,
  VERCEL_DASHBOARD_URL,
} from "../data/projects.js";

/**
 * @typedef {Object} DeployProject
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} canonicalPath
 * @property {string} branch
 * @property {string} github
 * @property {string|null} productionUrl
 * @property {boolean} vercel
 */

const STATUS = {
  idle: { label: "Not checked", className: "deploy-status--idle" },
  checking: { label: "Checking…", className: "deploy-status--checking" },
  up: { label: "Reachable", className: "deploy-status--up" },
  down: { label: "Unreachable", className: "deploy-status--down" },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderProjectRow(project, statusKey = "idle") {
  const status = STATUS[statusKey] || STATUS.idle;
  const prod = project.productionUrl
    ? `<a class="deploy-link" href="${escapeHtml(project.productionUrl)}" target="_blank" rel="noreferrer">Production</a>`
    : `<span class="deploy-muted">No Vercel link</span>`;
  const gh = `<a class="deploy-link" href="${escapeHtml(project.github)}" target="_blank" rel="noreferrer">GitHub</a>`;

  return `
    <article class="deploy-card" data-project-id="${escapeHtml(project.id)}" data-prod-url="${escapeHtml(project.productionUrl || "")}">
      <div class="deploy-card__head">
        <h3>${escapeHtml(project.name)}</h3>
        <span class="deploy-status ${status.className}" data-status>${status.label}</span>
      </div>
      <p class="deploy-card__meta">
        <span class="deploy-chip">${escapeHtml(project.category)}</span>
        <span class="deploy-chip">${escapeHtml(project.branch)}</span>
        ${project.vercel ? '<span class="deploy-chip">Vercel</span>' : ""}
      </p>
      <p class="deploy-card__path"><code>${escapeHtml(project.canonicalPath)}</code></p>
      <div class="deploy-card__actions">${prod} ${gh}</div>
    </article>
  `;
}

async function checkUrl(url) {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, { method: "HEAD", mode: "no-cors", signal: controller.signal });
    clearTimeout(timer);
    return response.type === "opaque" || response.ok;
  } catch {
    return false;
  }
}

async function verifyAll(container) {
  const cards = [...container.querySelectorAll(".deploy-card")];
  for (const card of cards) {
    const statusEl = card.querySelector("[data-status]");
    const url = card.dataset.prodUrl;
    statusEl.textContent = STATUS.checking.label;
    statusEl.className = `deploy-status ${STATUS.checking.className}`;
    if (!url) {
      statusEl.textContent = "No URL";
      statusEl.className = "deploy-status deploy-status--idle";
      continue;
    }
    const up = await checkUrl(url);
    const next = up ? STATUS.up : STATUS.down;
    statusEl.textContent = next.label;
    statusEl.className = `deploy-status ${next.className}`;
  }
}

function renderDuplicates() {
  return DUPLICATE_FOLDERS.map(
    (row) => `
      <li>
        <strong>${escapeHtml(row.canonical)}</strong>
        <span class="deploy-muted">instead of</span>
        ${row.duplicates.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ")}
        <p>${escapeHtml(row.note)}</p>
      </li>
    `
  ).join("");
}

export function initDeployDashboard() {
  renderNav("deploys");

  const grid = document.querySelector("#deployGrid");
  const dupList = document.querySelector("#duplicateList");
  const verifyBtn = document.querySelector("#verifyAllBtn");

  if (!grid) return;

  const sorted = [...DEPLOY_PROJECTS].sort((a, b) => a.name.localeCompare(b.name));
  grid.innerHTML = sorted.map((p) => renderProjectRow(p)).join("");

  if (dupList) {
    dupList.innerHTML = renderDuplicates();
  }

  const guidance = document.querySelector("#deployGuidance");
  if (guidance) {
    guidance.textContent = DEPLOY_GUIDANCE.onedriveWarning;
  }

  const vercelLink = document.querySelector("#vercelDashboardLink");
  if (vercelLink) vercelLink.href = VERCEL_DASHBOARD_URL;

  const githubLink = document.querySelector("#githubOrgLink");
  if (githubLink) githubLink.href = GITHUB_ORG_URL;

  verifyBtn?.addEventListener("click", () => verifyAll(grid));
}
