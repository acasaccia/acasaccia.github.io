// URL del Google Sheets (formato HTML pubblico)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/14vv2ViGi0bLs7k7AQHDAk0Ddk1b5aa12wLI-ckTlUE4/gviz/tq?tqx=out:json&gid=0";

// Numero di giorni da considerare per la classifica
const DAYS_TO_COUNT = 6;

// Carica e processa i dati
async function loadData() {
  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();

    // Google Sheets restituisce JSON con padding, lo dobbiamo rimuovere
    const jsonData = JSON.parse(text.substring(47).slice(0, -2));

    return parseGoogleSheetsData(jsonData);
  } catch (error) {
    console.error("Errore nel caricamento dei dati:", error);
    return [];
  }
}

// Parsea i dati dalla risposta di Google Sheets
function parseGoogleSheetsData(data) {
  const players = [];
  const rows = data.table.rows;

  if (rows.length < 2) return players; // Nessun dato

  // Prima riga contiene gli header, saltiamola
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.c || !row.c[0] || !row.c[0].v) continue; // Riga vuota

    const playerName = row.c[0].v;
    if (!playerName) continue;

    const gameResults = [];
    let totalGW = 0;
    let totalVP = 0;

    // Ogni giornata ha 2 colonne: GW e VP
    // Le colonne partono da indice 1 (0 è il nome del giocatore)
    // Formato: G1 GW (idx 1), G1 VP (idx 2), G2 GW (idx 3), G2 VP (idx 4), ...
    let dayIndex = 0;
    for (let col = 1; col < row.c.length - 11; col += 2) {
      // -11 perché le ultime colonne sono i totali
      const gwCell = row.c[col];
      const vpCell = row.c[col + 1];

      if (!gwCell && !vpCell) break; // Fine dei dati di giornate

      const gw = gwCell && gwCell.v !== null ? gwCell.v : 0;
      const vp = vpCell && vpCell.v !== null ? vpCell.v : 0;

      if (gw !== 0 || vp !== 0) {
        // Solo se ha giocato
        const dayScore = gw * 1000 + vp;
        gameResults.push({
          day: dayIndex + 1,
          gw: gw,
          vp: vp,
          score: dayScore,
        });

        totalGW += gw;
        totalVP += vp;
      }

      dayIndex++;
    }

    // Ordina i risultati per punteggio (migliori prima)
    gameResults.sort((a, b) => b.score - a.score);

    // Prendi i migliori N giorni
    const bestDays = gameResults.slice(0, DAYS_TO_COUNT);
    const bestDaysScore = bestDays.reduce((sum, day) => sum + day.score, 0);

    players.push({
      name: playerName,
      totalGW: totalGW,
      totalVP: totalVP,
      daysPlayed: gameResults.length,
      bestDaysScore: bestDaysScore,
      allDays: gameResults,
      bestDays: bestDays.map((d) => d.day),
    });
  }

  // Ordina per punteggio migliori giorni
  players.sort((a, b) => {
    if (b.bestDaysScore !== a.bestDaysScore) {
      return b.bestDaysScore - a.bestDaysScore;
    }
    // In caso di parità, ordina per VP totali
    return b.totalVP - a.totalVP;
  });

  return players;
}

// Converte un punteggio numerico in formato leggibile (es. 1006 -> "1 GW 6 VP")
function formatScore(score) {
  const gw = Math.floor(score / 1000);
  const vp = score % 1000;
  if (gw === 0 && vp === 0) return "0";
  if (gw === 0) return `${vp} VP`;
  if (vp === 0) return `${gw} GW`;
  return `${gw} GW ${vp} VP`;
}

// Renderizza la tabella della classifica
function renderStandings(players) {
  const tbody = document.getElementById("standingsBody");
  tbody.innerHTML = "";

  players.forEach((player, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${player.totalGW}</td>
            <td>${player.totalVP}</td>
            <td>${player.daysPlayed}</td>
        `;
    tbody.appendChild(row);
  });
}

// Renderizza i dettagli dei punteggi
function renderScoreDetails(players) {
  const container = document.getElementById("scoreDetails");
  container.innerHTML = "";

  players.forEach((player) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-compact";

    // Header del giocatore
    const header = document.createElement("div");
    header.className = "player-compact-header";
    header.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">Totale: ${formatScore(player.bestDaysScore)}</span>
        `;
    playerDiv.appendChild(header);

    // Badges dei punteggi
    const scoresDiv = document.createElement("div");
    scoresDiv.className = "score-badges";

    player.allDays.forEach((day) => {
      const isBestDay = player.bestDays.includes(day.day);
      const badge = document.createElement("div");
      badge.className = `score-badge${isBestDay ? " best" : ""}`;
      badge.innerHTML = `
                <div class="badge-day">G${day.day}</div>
                <div class="badge-score">${formatScore(day.score)}</div>
            `;
      scoresDiv.appendChild(badge);
    });

    playerDiv.appendChild(scoresDiv);
    container.appendChild(playerDiv);
  });
}

// Inizializza l'applicazione
async function init() {
  const players = await loadData();

  if (players.length === 0) {
    document.getElementById("standingsBody").innerHTML =
      '<tr><td colspan="5">Errore nel caricamento dei dati</td></tr>';
    return;
  }

  renderStandings(players);
  renderScoreDetails(players);
}

// Avvia al caricamento della pagina
document.addEventListener("DOMContentLoaded", init);
