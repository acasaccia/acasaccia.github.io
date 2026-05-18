// League configuration
const TOTAL_DAYS = 10;
const BEST_DAYS_COUNT = 6;

// Load data from localStorage
function loadData() {
  const saved = localStorage.getItem("vtesLeagueData");
  if (saved) {
    return JSON.parse(saved);
  }
  return { participants: [], scores: {} };
}

// Calculate standings
function calculateStandings(leagueData) {
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
  const leagueData = loadData();
  const standings = calculateStandings(leagueData);
  const tbody = document.getElementById("standingsBody");
  tbody.innerHTML = "";

  if (standings.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="5" style="text-align: center;">Nessun dato disponibile</td>';
    tbody.appendChild(row);
    return;
  }

  standings.forEach((standing, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${standing.participant}</strong></td>
            <td>${standing.totalGW}</td>
            <td>${standing.totalVP.toFixed(1)}</td>
            <td>${standing.daysPlayed}</td>
        `;
    tbody.appendChild(row);
  });
}

// Display score details
function displayScoreDetails() {
  const leagueData = loadData();
  const standings = calculateStandings(leagueData);
  const detailsDiv = document.getElementById("scoreDetails");
  detailsDiv.innerHTML = "";

  if (standings.length === 0) {
    detailsDiv.innerHTML =
      '<p style="text-align: center; color: #999;">Nessun punteggio disponibile</p>';
    return;
  }

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
                    Giorno ${score.day}: ${score.gw} GW, ${score.vp} VP
                </span>
            `;
    });

    participantDiv.innerHTML = html;
    detailsDiv.appendChild(participantDiv);
  });
}

// Initialize
displayStandings();
displayScoreDetails();

// Auto-refresh every 30 seconds
setInterval(() => {
  displayStandings();
  displayScoreDetails();
}, 30000);
