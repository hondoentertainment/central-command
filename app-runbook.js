import { requireAuth } from "./lib/auth.js";
import { renderNav } from "./lib/nav.js";
import { loadNotes, saveNotes } from "./lib/storage.js";

const elements = {
  notes: document.querySelector("#notes"),
};

requireAuth(initialize);

function initialize() {
  renderNav("runbook");
  elements.notes.value = loadNotes();
  elements.notes.addEventListener("input", (event) => saveNotes(event.target.value));
}
