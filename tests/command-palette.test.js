import assert from "node:assert";
import { searchPages, searchRunbook, searchTools, searchTasks, searchProjectSubtasks } from "../lib/command-palette.js";

const tools = [
  { name: "Notion", category: "Productivity", description: "Docs and notes" },
  { name: "ESPN", category: "Sports", description: "Scores and news" },
];

assert.strictEqual(searchTools(tools, "not").length, 1);
assert.strictEqual(searchTools(tools, "sports").length, 1);
assert.strictEqual(searchTools(tools, "missing").length, 0);

const runbookMatches = searchRunbook("Morning checklist\nReview ESPN scores\nShip deploy", "espn");
assert.strictEqual(runbookMatches.length, 1);
assert.strictEqual(runbookMatches[0].lineIndex, 1);

const pageMatches = searchPages("settings", "index.html");
assert.ok(pageMatches.some((page) => page.href === "settings.html"));
assert.ok(pageMatches.every((page) => page.href !== "index.html"));

const defaultPages = searchPages("", "settings.html");
assert.ok(defaultPages.length > 0);
assert.ok(defaultPages.every((page) => page.href !== "settings.html"));

// searchTasks tests
const tasks = [
  { title: "Fix login bug", notes: "Users can't sign in", status: "open", priority: "high", dueDate: "2026-04-10", projectId: "p1" },
  { title: "Write docs", notes: "API documentation", status: "done", priority: "low", dueDate: null, projectId: "p2" },
];
assert.strictEqual(searchTasks(tasks, "login").length, 1);
assert.strictEqual(searchTasks(tasks, "api").length, 1); // matches notes
assert.strictEqual(searchTasks(tasks, "missing").length, 0);
assert.strictEqual(searchTasks(tasks, "").length, 0);
assert.strictEqual(searchTasks([], "login").length, 0);

// searchProjectSubtasks tests
const projects = [
  { name: "Project Alpha", id: "p1", subtasks: [{ title: "Design mockup" }, { title: "Build API" }] },
  { name: "Project Beta", id: "p2", subtasks: [{ title: "Write tests" }] },
];
const subtaskMatches = searchProjectSubtasks(projects, "api");
assert.strictEqual(subtaskMatches.length, 1);
assert.strictEqual(subtaskMatches[0].projectName, "Project Alpha");
assert.strictEqual(subtaskMatches[0].subtaskTitle, "Build API");
assert.strictEqual(subtaskMatches[0].projectId, "p1");
assert.strictEqual(searchProjectSubtasks(projects, "").length, 0);
assert.strictEqual(searchProjectSubtasks(projects, "missing").length, 0);

// Tasks page is now searchable
const taskPageMatches = searchPages("task", "index.html");
assert.ok(taskPageMatches.some((page) => page.href === "tasks.html"));

console.log("command-palette.test.js: all assertions passed");
export default { ok: true };
