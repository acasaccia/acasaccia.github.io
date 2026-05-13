// VTES Crypt Simulator - Main Application Logic
import {
  runSimulation,
  calculateSpecificCombination,
  simulateWithQuery,
} from "./simulation.js";
import {
  renderResults,
  renderSpecificCombo,
  renderQueryResult,
  clearQueryResult,
  renderEmptyState,
  renderError,
} from "./ui-renderer.js";

// Application state
let currentSimulationData = null;

// Utility: Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Update simulation output
function updateOutput() {
  const input = document.getElementById("input").value;
  const output = document.getElementById("output");

  if (!input.trim()) {
    renderEmptyState(output);
    currentSimulationData = null;
    return;
  }

  currentSimulationData = runSimulation(input);
  renderResults(currentSimulationData, output, handleVampireSelection);
}

// Handle vampire quantity selection for specific combinations
function handleVampireSelection(event) {
  const inputs = document.querySelectorAll(".vamp-quantity");
  const selected = [];
  let total = 0;

  inputs.forEach((input) => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) {
      selected.push({ name: input.dataset.name, qty });
      total += qty;
    }
  });

  if (total === 0) {
    renderSpecificCombo([], 0, null, 0);
    return;
  }

  if (total > 4) {
    renderSpecificCombo(
      selected,
      total,
      { count: 0, probability: 0 },
      currentSimulationData.draws,
    );
    return;
  }

  // Build target array with duplicates
  const targetVampires = [];
  selected.forEach((s) => {
    for (let i = 0; i < s.qty; i++) {
      targetVampires.push(s.name);
    }
  });

  // Calculate probability for this specific combination
  const result = calculateSpecificCombination(
    currentSimulationData.deck,
    targetVampires,
    currentSimulationData.draws,
    currentSimulationData.handSize,
  );

  renderSpecificCombo(selected, total, result, currentSimulationData.draws);
}

// Handle query calculation
function handleCalculateQuery() {
  if (!currentSimulationData) {
    const container = document.getElementById("queryResult");
    renderError(container, "Please enter a deck first.");
    return;
  }

  const query = {};
  const discipline = document.getElementById("queryDiscipline").value.trim();
  const minCapacity = document.getElementById("queryMinCapacity").value;
  const maxCapacity = document.getElementById("queryMaxCapacity").value;
  const title = document.getElementById("queryTitle").value.trim();
  const clan = document.getElementById("queryClan").value.trim();

  if (discipline) query.discipline = discipline;
  if (minCapacity) query.minCapacity = parseInt(minCapacity);
  if (maxCapacity) query.maxCapacity = parseInt(maxCapacity);
  if (title) query.title = title;
  if (clan) query.clan = clan;

  if (Object.keys(query).length === 0) {
    const container = document.getElementById("queryResult");
    renderError(container, "Please enter at least one query parameter.");
    return;
  }

  const result = simulateWithQuery(
    currentSimulationData.deck,
    currentSimulationData.vampireData,
    currentSimulationData.draws,
    currentSimulationData.handSize,
    query,
  );

  renderQueryResult(query, result, currentSimulationData.draws);
}

// Handle clear query
function handleClearQuery() {
  document.getElementById("queryDiscipline").value = "";
  document.getElementById("queryMinCapacity").value = "";
  document.getElementById("queryMaxCapacity").value = "";
  document.getElementById("queryTitle").value = "";
  document.getElementById("queryClan").value = "";
  clearQueryResult();
}

// Initialize application
function init() {
  // Debounced input handler
  const debouncedUpdate = debounce(updateOutput, 500);

  // Show initial state
  const output = document.getElementById("output");
  renderEmptyState(output);

  // Event listeners
  document.getElementById("input").addEventListener("input", debouncedUpdate);
  document
    .getElementById("calculateQuery")
    .addEventListener("click", handleCalculateQuery);
  document
    .getElementById("clearQuery")
    .addEventListener("click", handleClearQuery);
}

// Start application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
