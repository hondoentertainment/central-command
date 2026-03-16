import { renderNav } from "./lib/nav.js";
import { RS500_ALBUMS, RS500_GENRES, RS500_DECADES } from "./data/rs500.js";

const state = {
  genre: "All Genres",
  decade: "All Decades",
};

const elements = {
  genreSelect: document.querySelector("#rs500Genre"),
  decadeSelect: document.querySelector("#rs500Decade"),
  countEl: document.querySelector("#rs500Count"),
  grid: document.querySelector("#rs500Grid"),
};

initialize();

function initialize() {
  renderNav("music");
  populateGenreSelect();
  populateDecadeSelect();
  elements.genreSelect?.addEventListener("change", (e) => {
    state.genre = e.target.value;
    render();
  });
  elements.decadeSelect?.addEventListener("change", (e) => {
    state.decade = e.target.value;
    render();
  });
  render();
}

function populateGenreSelect() {
  if (!elements.genreSelect) return;
  elements.genreSelect.innerHTML = RS500_GENRES.map(
    (g) => `<option value="${g}">${g}</option>`
  ).join("");
}

function populateDecadeSelect() {
  if (!elements.decadeSelect) return;
  elements.decadeSelect.innerHTML = RS500_DECADES.map(
    (d) => `<option value="${d}">${d}</option>`
  ).join("");
}

function getDecadeFromYear(year) {
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  if (year >= 1990) return "1990s";
  if (year >= 1980) return "1980s";
  if (year >= 1970) return "1970s";
  if (year >= 1960) return "1960s";
  if (year >= 1950) return "1950s";
  return "";
}

function getFilteredAlbums() {
  return RS500_ALBUMS.filter((album) => {
    const genreMatch =
      state.genre === "All Genres" || album.genre === state.genre;
    const albumDecade = getDecadeFromYear(album.year);
    const decadeMatch =
      state.decade === "All Decades" || albumDecade === state.decade;
    return genreMatch && decadeMatch;
  });
}

function render() {
  const albums = getFilteredAlbums();
  if (!elements.grid) return;

  if (elements.countEl) {
    elements.countEl.textContent =
      albums.length === 0
        ? "No albums match the selected filters."
        : `Showing ${albums.length} of ${RS500_ALBUMS.length} albums`;
  }

  elements.grid.innerHTML = "";

  if (albums.length === 0) {
    const empty = document.createElement("p");
    empty.className = "inline-empty-state";
    empty.textContent = "Try a different genre or decade.";
    elements.grid.appendChild(empty);
    return;
  }

  albums.forEach((album) => {
    const card = document.createElement("a");
    card.className = "rs500-card";
    card.href = album.spotifyUrl;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.setAttribute("aria-label", `Open ${album.title} by ${album.artist} on Spotify`);

    const title = document.createElement("h3");
    title.className = "rs500-card__title";
    title.textContent = album.title;

    const meta = document.createElement("p");
    meta.className = "rs500-card__meta";
    meta.innerHTML = `#${album.rank} <span class="rs500-card__year">(${album.year})</span> ${escapeHtml(album.artist)}${album.genre ? ` <span class="rs500-card__genre">${escapeHtml(album.genre)}</span>` : ""}`;

    card.append(title, meta);
    elements.grid.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
