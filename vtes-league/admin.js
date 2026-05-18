// League configuration
const TOTAL_DAYS = 10;
const BEST_DAYS_COUNT = 6;

// Data structure
let leagueData = {
  participants: [],
  scores: {},
};

// Load data from localStorage on startup
function loadData() {
  const saved = localStorage.getItem("vtesLeagueData");
  if (saved) {
    leagueData = JSON.parse(saved);
  }
  updateUI();
}

// Save data to localStorage
function saveData() {
  localStorage.setItem("vtesLeagueData", JSON.stringify(leagueData));
}

// Initialize day select
function initDaySelect() {
  const daySelect = document.getElementById("daySelect");
  daySelect.innerHTML = '<option value="">Seleziona giorno...</option>';
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Giorno ${i}`;
    daySelect.appendChild(option);
  }
}

// Update participant select
function updateParticipantSelect() {
  const select = document.getElementById("participantSelect");
  select.innerHTML = '<option value="">Seleziona giocatore...</option>';

  leagueData.participants.forEach((participant) => {
    const option = document.createElement("option");
    option.value = participant;
    option.textContent = participant;
    select.appendChild(option);
  });
}

// Add participant
function addParticipant() {
  const input = document.getElementById("participantName");
  const name = input.value.trim();

  if (!name) {
    alert("Inserisci il nome del giocatore");
    return;
  }

  if (leagueData.participants.includes(name)) {
    alert("Giocatore già presente");
    return;
  }

  leagueData.participants.push(name);
  leagueData.scores[name] = {};

  input.value = "";
  saveData();
  updateUI();
  alert(`Giocatore "${name}" aggiunto con successo`);
}

// Add score
function addScore() {
  const participant = document.getElementById("participantSelect").value;
  const day = document.getElementById("daySelect").value;
  const gw = parseFloat(document.getElementById("gwInput").value);
  const vp = parseFloat(document.getElementById("vpInput").value);

  if (!participant || !day) {
    alert("Seleziona un giocatore e un giorno");
    return;
  }

  if (isNaN(gw) || isNaN(vp) || gw < 0 || vp < 0) {
    alert(
      "Inserisci punteggi validi (GW e VP devono essere numeri non negativi)",
    );
    return;
  }

  leagueData.scores[participant][`day${day}`] = { gw, vp };

  document.getElementById("gwInput").value = "";
  document.getElementById("vpInput").value = "";

  saveData();
  updateUI();
  alert(`Punteggio salvato per ${participant} - Giorno ${day}`);
}

// Delete a specific score
function deleteScore(participant, day) {
  if (
    confirm(`Eliminare il punteggio di ${participant} per il Giorno ${day}?`)
  ) {
    delete leagueData.scores[participant][`day${day}`];
    saveData();
    updateUI();
  }
}

// Calculate standings for display
function calculateStandings() {
  const standings = [];

  leagueData.participants.forEach((participant) => {
    const scores = leagueData.scores[participant];
    const dayScores = [];

    for (let i = 1; i <= TOTAL_DAYS; i++) {
      const dayKey = `day${i}`;
      if (scores[dayKey]) {
        dayScores.push({
          day: i,
          gw: scores[dayKey].gw,
          vp: scores[dayKey].vp,
        });
      }
    }

    const sortedDays = [...dayScores].sort((a, b) => {
      if (b.gw !== a.gw) return b.gw - a.gw;
      return b.vp - a.vp;
    });

    const bestDays = sortedDays.slice(
      0,
      Math.min(BEST_DAYS_COUNT, sortedDays.length),
    );
    const bestDayNumbers = new Set(bestDays.map((d) => d.day));

    standings.push({
      participant,
      bestDays: bestDayNumbers,
      allScores: dayScores,
    });
  });

  return standings;
}

// Display score details
function displayScoreDetails() {
  const standings = calculateStandings();
  const detailsDiv = document.getElementById("scoreDetails");
  detailsDiv.innerHTML = "";

  if (standings.length === 0) {
    detailsDiv.innerHTML =
      '<p style="text-align: center; color: #999;">Nessun punteggio inserito</p>';
    return;
  }

  standings.forEach((standing) => {
    const participantDiv = document.createElement("div");
    participantDiv.className = "participant-scores";

    let html = `<h3>${standing.participant}</h3>`;

    if (standing.allScores.length === 0) {
      html += '<p style="color: #999;">Nessun punteggio</p>';
    } else {
      const sortedScores = standing.allScores.sort((a, b) => a.day - b.day);

      sortedScores.forEach((score) => {
        const isBest = standing.bestDays.has(score.day);
        const className = isBest ? "day-score best" : "day-score";
        html += `
                    <span class="${className}">
                        Giorno ${score.day}: ${score.gw} GW, ${score.vp} VP
                        <button class="delete-score" onclick="deleteScore('${standing.participant}', ${score.day})">×</button>
                    </span>
                `;
      });
    }

    participantDiv.innerHTML = html;
    detailsDiv.appendChild(participantDiv);
  });
}

// Update all UI elements
function updateUI() {
  updateParticipantSelect();
  displayScoreDetails();
}

// Clear all data
function clearData() {
  if (
    confirm(
      "Sei sicuro di voler cancellare tutti i dati? Questa operazione non può essere annullata.",
    )
  ) {
    if (confirm("CONFERMA: Eliminare tutti i giocatori e i punteggi?")) {
      leagueData = { participants: [], scores: {} };
      saveData();
      updateUI();
      alert("Tutti i dati sono stati eliminati");
    }
  }
}

// Export data
function exportData() {
  const dataStr = JSON.stringify(leagueData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lega-barghigiana-2026-${new Date().toISOString().split("T")[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// Import data
function importData() {
  document.getElementById("importFile").click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.participants && imported.scores) {
        if (confirm("Questo sostituirà tutti i dati attuali. Continuare?")) {
          leagueData = imported;
          saveData();
          updateUI();
          alert("Dati importati con successo");
        }
      } else {
        alert("Formato dati non valido");
      }
    } catch (error) {
      alert("Errore nell'importazione: " + error.message);
    }
  };
  reader.readAsText(file);
}

// Event listeners
document
  .getElementById("addParticipant")
  .addEventListener("click", addParticipant);
document.getElementById("participantName").addEventListener("keypress", (e) => {
  if (e.key === "Enter") addParticipant();
});

document.getElementById("addScore").addEventListener("click", addScore);
document.getElementById("clearData").addEventListener("click", clearData);
document.getElementById("exportData").addEventListener("click", exportData);
document.getElementById("importData").addEventListener("click", importData);
document
  .getElementById("importFile")
  .addEventListener("change", handleImportFile);

// Initialize
initDaySelect();
loadData();
