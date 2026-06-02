const elements = {
  movies: document.getElementById("movies"),
  status: document.getElementById("status"),
  stats: document.getElementById("stats"),
  searchInput: document.getElementById("searchInput")
};

let allMovies = [];

function normalizeText(value) {
  return (value ?? "").toString().trim();
}

function isRowEmpty(row) {
  return Object.values(row).every(v => normalizeText(v) === "");
}

function normalizeRows(rows) {
  const normalized = [];
  let lastIdTmdb = "";
  let lastNom = "";

  for (const row of rows) {
    if (!row || isRowEmpty(row)) continue;

    const clean = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key.trim()] = normalizeText(value);
    }

    if (!clean.id_tmdb) clean.id_tmdb = lastIdTmdb;
    if (!clean.nom) clean.nom = lastNom;

    if (clean.id_tmdb) lastIdTmdb = clean.id_tmdb;
    if (clean.nom) lastNom = clean.nom;

    if (!clean.nom && !clean.id_tmdb && !clean.type && !clean.description && !clean.durees) {
      continue;
    }

    normalized.push(clean);
  }
  return normalized;
}

function groupMovies(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = row.id_tmdb ? `tmdb:${row.id_tmdb}` : `nom:${row.nom || "unknown"}`;

    if (!map.has(key)) {
      map.set(key, {
        id_tmdb: row.id_tmdb || "",
        nom: row.nom || "Film sans titre",
        rows: []
      });
    }
    map.get(key).rows.push(row);
  }

  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}

function escapeHtml(value) {
  return normalizeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStats(groups) {
  const versionsCount = groups.reduce((acc, movie) => acc + movie.rows.length, 0);
  elements.stats.textContent = `${groups.length} films • ${versionsCount} versions`;
}

function renderEmpty(message) {
  elements.movies.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

function renderMovies(groups) {
  if (!groups.length) {
    renderEmpty("Aucun résultat.");
    return;
  }

  elements.movies.innerHTML = groups.map(movie => {
    const versionRows = movie.rows.map(row => {
      return `
        <tr>
          <td data-label="Type"><span class="type-pill">${escapeHtml(row.type || "—")}</span></td>
          <td data-label="Description" class="desc">${escapeHtml(row.description || "—")}</td>
          <td data-label="Durée" class="runtime">${escapeHtml(row.durees || "—")}</td>
        </tr>
      `;
    }).join("");

    const tmdbBadge = movie.id_tmdb
      ? `<a class="badge link" href="${CONFIG.TMDB_BASE_URL}${encodeURIComponent(movie.id_tmdb)}" target="_blank" rel="noreferrer">TMDB #${escapeHtml(movie.id_tmdb)}</a>`
      : `<span class="badge" style="opacity: 0.5;">ID TMDB manquant</span>`;

    return `
      <article class="movie-card">
        <div class="movie-card__top">
          <div>
            <h2 class="movie-title">${escapeHtml(movie.nom)}</h2>
            <div class="movie-meta">
              <span>${movie.rows.length} version${movie.rows.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div class="badges">
            ${tmdbBadge}
          </div>
        </div>

        <div class="movie-card__body">
          <table class="version-table">
            <thead>
              <tr>
                <th style="width: 15%;">Type</th>
                <th style="width: 70%;">Description</th>
                <th style="width: 15%; text-align: right;">Durée</th>
              </tr>
            </thead>
            <tbody>
              ${versionRows}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }).join("");
}

function applySearch() {
  const q = normalizeText(elements.searchInput.value).toLowerCase();

  const filtered = allMovies.filter(movie => {
    const haystack = [
      movie.nom,
      movie.id_tmdb,
      ...movie.rows.flatMap(row => [row.type, row.description, row.durees])
    ].join(" ").toLowerCase();

    return haystack.includes(q);
  });

  renderStats(filtered);
  renderMovies(filtered);
}

async function loadData() {
  try {
    const response = await fetch(CONFIG.CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`CSV inaccessible (${response.status})`);

    const csvText = await response.text();
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim()
    });

    const rows = normalizeRows(parsed.data || []);
    allMovies = groupMovies(rows);

    elements.status.style.display = "none";
    applySearch();
  } catch (error) {
    console.error(error);
    elements.status.textContent = "Impossible de charger la base de données.";
    renderEmpty("Erreur de lecture du fichier CSV. Vérifie l'URL de publication.");
  }
}

elements.searchInput.addEventListener("input", applySearch);
loadData();