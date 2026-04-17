import { initCategoryHubPage } from "./lib/category-hub-page.js";
import {
  aggregateIntegrationEvents,
  clearIntegrationEvents,
  readIntegrationEvents,
} from "./lib/integrations.js";
import { showConfirmDialog } from "./lib/confirm-dialog.js";
import { showToast } from "./lib/toast.js";

initCategoryHubPage({
  navKey: "admin",
  gridSelector: "#adminGrid",
  category: "Admin",
  emptyStateMessage:
    "Add tools with category Admin (e.g. GitHub, Vercel, CI dashboards) to see them here.",
  emptyStateHint: 'Head to the <a href="registry.html">Tool Registry</a> to add admin and DevOps tools.',
});

function formatRelative(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderTelemetry() {
  const container = document.getElementById("integrationTelemetry");
  if (!container) return;

  const events = readIntegrationEvents();
  const rows = aggregateIntegrationEvents(events);
  const totalOpens = rows.reduce((sum, row) => sum + row.opens, 0);

  if (totalOpens === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">No integration opens recorded yet</p>
        <p class="empty-state__text">Launch an integration from the nav, command palette, or tool card to populate this table.</p>
      </div>
    `;
    return;
  }

  const body = rows
    .map((row) => {
      const shareText = totalOpens > 0 ? `${Math.round((row.opens / totalOpens) * 100)}%` : "0%";
      return `
        <tr>
          <td class="integration-telemetry__name">
            <span aria-hidden="true">${escapeHtml(row.icon)}</span>
            <span>${escapeHtml(row.name)}</span>
          </td>
          <td class="integration-telemetry__opens">${row.opens}</td>
          <td class="integration-telemetry__share">${shareText}</td>
          <td class="integration-telemetry__last">${escapeHtml(formatRelative(row.lastOpenedAt))}</td>
          <td class="integration-telemetry__source">${row.lastSource ? escapeHtml(row.lastSource) : "—"}</td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <table class="integration-telemetry">
      <thead>
        <tr>
          <th scope="col">Integration</th>
          <th scope="col">Opens</th>
          <th scope="col">Share</th>
          <th scope="col">Last opened</th>
          <th scope="col">Last source</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <p class="panel__intro-text" style="margin-top: 12px;">
      ${totalOpens} opens across ${rows.filter((r) => r.opens > 0).length} integrations · stored locally, capped at the 100 most recent events.
    </p>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderTelemetry();

  document.getElementById("integrationTelemetryRefresh")?.addEventListener("click", () => {
    renderTelemetry();
    showToast("Integration telemetry refreshed.");
  });

  document.getElementById("integrationTelemetryClear")?.addEventListener("click", async () => {
    const confirmed = await showConfirmDialog({
      title: "Clear integration event log?",
      message: "This removes all locally recorded integration opens. Totals will reset to zero.",
      confirmLabel: "Clear",
      destructive: true,
    });
    if (!confirmed) return;
    clearIntegrationEvents();
    renderTelemetry();
    showToast("Integration event log cleared.");
  });
});
