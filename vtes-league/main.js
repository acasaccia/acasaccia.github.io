// League configuration
const TOTAL_DAYS = 10;
const BEST_DAYS_COUNT = 6;

// Data structure
let leagueData = {
  participants: [], // Array of participant names
  scores: {}, // { participantName: { day1: {gw, vp}, day2: {gw, vp}, ... } }
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
  daySelect.innerHTML = '<option value="">Select day...</option>';
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Day ${i}`;
    daySelect.appendChild(option);
  }
}

// Update participant select
function updateParticipantSelect() {
  const select = document.getElementById("participantSelect");
  select.innerHTML = '<option value="">Select participant...</option>';

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
    alert("Please enter a participant name");
    return;
  }

  if (leagueData.participants.includes(name)) {
    alert("Participant already exists");
    return;
  }

  leagueData.participants.push(name);
  leagueData.scores[name] = {};

  input.value = "";
  saveData();
  updateUI();
}

// Add score
function addScore() {
  const participant = document.getElementById("participantSelect").value;
  const day = document.getElementById("daySelect").value;
  const gw = parseFloat(document.getElementById("gwInput").value);
  const vp = parseFloat(document.getElementById("vpInput").value);

  if (!participant || !day) {
    alert("Please select a participant and day");
    return;
  }

  if (isNaN(gw) || isNaN(vp) || gw < 0 || vp < 0) {
    alert("Please enter valid scores (GW and VP must be non-negative numbers)");
    return;
  }

  leagueData.scores[participant][`day${day}`] = { gw, vp };

  document.getElementById("gwInput").value = "";
  document.getElementById("vpInput").value = "";

  saveData();
  updateUI();
}

// Delete a specific score
function deleteScore(participant, day) {
  if (confirm(`Delete score for ${participant} on Day ${day}?`)) {
    delete leagueData.scores[participant][`day${day}`];
    saveData();
    updateUI();
  }
}

// Calculate standings
function calculateStandings() {
  const standings = [];

  leagueData.participants.forEach((participant) => {
    const scores = leagueData.scores[participant];
    const dayScores = [];

    // Collect all day scores
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

    // Sort by GW descending, then VP descending to get best days
    const sortedDays = [...dayScores].sort((a, b) => {
      if (b.gw !== a.gw) return b.gw - a.gw;
      return b.vp - a.vp;
    });

    // Take best 6 days
    const bestDays = sortedDays.slice(
      0,
      Math.min(BEST_DAYS_COUNT, sortedDays.length),
    );
    const bestDayNumbers = new Set(bestDays.map((d) => d.day));

    // Calculate totals from best days
    const totalGW = bestDays.reduce((sum, day) => sum + day.gw, 0);
    const totalVP = bestDays.reduce((sum, day) => sum + day.vp, 0);

    standings.push({
      participant,
      totalGW,
      totalVP,
      daysPlayed: dayScores.length,
      bestDays: bestDayNumbers,
      allScores: dayScores,
    });
  });

  // Sort standings by GW descending, then VP descending
  standings.sort((a, b) => {
    if (b.totalGW !== a.totalGW) return b.totalGW - a.totalGW;
    return b.totalVP - a.totalVP;
  });

  return standings;
}

// Display standings
function displayStandings() {
  const standings = calculateStandings();
  const tbody = document.getElementById("standingsBody");
  tbody.innerHTML = "";

  standings.forEach((standing, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${standing.participant}</td>
            <td>${standing.totalGW}</td>
            <td>${standing.totalVP.toFixed(1)}</td>
            <td>${standing.daysPlayed}</td>
        `;
    tbody.appendChild(row);
  });
}

// Display score details
function displayScoreDetails() {
  const standings = calculateStandings();
  const detailsDiv = document.getElementById("scoreDetails");
  detailsDiv.innerHTML = "";

  standings.forEach((standing) => {
    const participantDiv = document.createElement("div");
    participantDiv.className = "participant-scores";

    let html = `<h3>${standing.participant}</h3>`;

    // Sort scores by day number
    const sortedScores = standing.allScores.sort((a, b) => a.day - b.day);

    sortedScores.forEach((score) => {
      const isBest = standing.bestDays.has(score.day);
      const className = isBest ? "day-score best" : "day-score";
      html += `
                <span class="${className}">
                    Day ${score.day}: ${score.gw} GW, ${score.vp} VP
                    <button class="delete-score" onclick="deleteScore('${standing.participant}', ${score.day})">×</button>
                </span>
            `;
    });

    participantDiv.innerHTML = html;
    detailsDiv.appendChild(participantDiv);
  });
}

// Update all UI elements
function updateUI() {
  updateParticipantSelect();
  displayStandings();
  displayScoreDetails();
}

// Clear all data
function clearData() {
  if (
    confirm("Are you sure you want to clear all data? This cannot be undone.")
  ) {
    leagueData = { participants: [], scores: {} };
    saveData();
    updateUI();
  }
}

// Export data
function exportData() {
  const dataStr = JSON.stringify(leagueData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vtes-league-${new Date().toISOString().split("T")[0]}.json`;
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
        if (confirm("This will replace all current data. Continue?")) {
          leagueData = imported;
          saveData();
          updateUI();
          alert("Data imported successfully");
        }
      } else {
        alert("Invalid data format");
      }
    } catch (error) {
      alert("Error importing data: " + error.message);
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
