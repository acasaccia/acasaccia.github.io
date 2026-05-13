// VTES Crypt Draw Simulator - Core Simulation Module

const DRAWS = 100000;
const HAND_SIZE = 4;

function parseCrypt(text) {
  const deck = [];
  const vampireData = {}; // Store unique vampire metadata
  const lines = text.split("\n");
  let inCryptSection = false;

  for (const line of lines) {
    // Track if we're in the crypt section
    if (line.match(/^Crypt\s*\(/i)) {
      inCryptSection = true;
      continue;
    }

    // Stop parsing when we hit the Library section
    if (line.match(/^Library\s*\(/i)) {
      inCryptSection = false;
      break;
    }

    // Skip empty lines, separators, and non-crypt content
    if (!line.trim() || line.startsWith("===")) continue;

    // Only parse lines that start with a number (count)
    const m = line.match(/^\s*(\d+)\s*x\s+(.+)/i);
    if (!m) continue;

    const count = parseInt(m[1]);
    const rest = m[2].trim();

    // Parse vampire data: Name  Capacity+Disciplines  Title  Clan
    // Example: "Aline Gädeke         7 POT PRE cel       baron   Brujah:6"
    const parts = rest.split(/\s{2,}/); // Split by 2+ spaces

    if (parts.length < 2) continue; // Need at least name and capacity+disciplines

    const name = parts[0].trim();

    // Parse capacity and disciplines from second part
    const capDiscTokens = parts[1].trim().split(/\s+/);
    const capacity = parseInt(capDiscTokens[0]);

    // Remaining tokens are disciplines
    const disciplineTokens = capDiscTokens.slice(1);
    const disciplines = parseDisciplines(disciplineTokens.join(" "));

    // Parse title and clan (parts 2 and 3 if exist)
    let title = "";
    let clan = "";

    if (parts.length > 2) {
      // Check if part 2 looks like a clan (contains :) or is a title
      if (parts[2].includes(":")) {
        clan = parts[2].split(":")[0].trim();
      } else {
        title = parts[2].trim();
        if (parts.length > 3) {
          clan = parts[3].split(":")[0].trim();
        }
      }
    }

    // Store vampire metadata (only once per unique vampire)
    if (!vampireData[name]) {
      vampireData[name] = {
        name,
        capacity,
        disciplines,
        title,
        clan,
      };
    }

    // Add vampire to deck (count times)
    for (let i = 0; i < count; i++) {
      deck.push(name);
    }
  }

  return { deck, vampireData };
}

function parseDisciplines(disciplineStr) {
  const superior = [];
  const inferior = [];
  const tokens = disciplineStr.trim().split(/\s+/);

  for (const token of tokens) {
    if (!token) continue;

    // Check if first letter is uppercase (superior) or lowercase (inferior)
    if (token[0] === token[0].toUpperCase() && token.length >= 3) {
      superior.push(token.toUpperCase());
    } else if (token.length >= 3) {
      inferior.push(token.toUpperCase());
    }
  }

  return { superior, inferior };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function simulate(deck, draws, handSize) {
  const deckSize = deck.length;
  const uniqueNames = [...new Set(deck)];

  const diversityCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const appearanceCounts = {};
  uniqueNames.forEach((n) => (appearanceCounts[n] = 0));

  const working = [...deck];

  for (let i = 0; i < draws; i++) {
    for (let j = 0; j < deckSize; j++) working[j] = deck[j];
    shuffle(working);

    const hand = working.slice(0, handSize);
    const seen = new Set(hand);

    const d = seen.size;
    if (diversityCounts[d] !== undefined) diversityCounts[d]++;

    seen.forEach((name) => appearanceCounts[name]++);
  }

  return { diversityCounts, appearanceCounts, uniqueNames };
}

export function runSimulation(text) {
  const { deck, vampireData } = parseCrypt(text);

  if (deck.length === 0) {
    return { error: "No vampires parsed. Check input format." };
  }

  const startTime = performance.now();
  const { diversityCounts, appearanceCounts, uniqueNames } = simulate(
    deck,
    DRAWS,
    HAND_SIZE,
  );
  const simulationTime = performance.now() - startTime;

  // Calculate copy counts
  const copyCounts = {};
  deck.forEach((n) => (copyCounts[n] = (copyCounts[n] || 0) + 1));

  // Sort vampires by appearance probability
  const sortedVampires = [...uniqueNames].sort(
    (a, b) => appearanceCounts[b] - appearanceCounts[a],
  );

  return {
    deck,
    vampireData,
    deckSize: deck.length,
    handSize: HAND_SIZE,
    draws: DRAWS,
    simulationTime,
    diversity: diversityCounts,
    vampires: sortedVampires.map((name) => ({
      name,
      copies: copyCounts[name],
      appearances: appearanceCounts[name],
      probability: appearanceCounts[name] / DRAWS,
      ...vampireData[name], // Include vampire metadata
    })),
  };
}

export function calculateSpecificCombination(
  deck,
  targetVampires,
  draws,
  handSize,
) {
  let matchCount = 0;
  const deckSize = deck.length;
  const working = [...deck];

  // Count required vampires by name
  const requiredCounts = {};
  targetVampires.forEach((name) => {
    requiredCounts[name] = (requiredCounts[name] || 0) + 1;
  });

  for (let i = 0; i < draws; i++) {
    for (let j = 0; j < deckSize; j++) working[j] = deck[j];
    shuffle(working);

    const hand = working.slice(0, handSize);

    // Count vampires in hand
    const handCounts = {};
    hand.forEach((name) => {
      handCounts[name] = (handCounts[name] || 0) + 1;
    });

    // Check if hand contains at least the required vampires
    const hasRequired = Object.entries(requiredCounts).every(
      ([name, count]) => (handCounts[name] || 0) >= count,
    );

    if (hasRequired) {
      matchCount++;
    }
  }

  return {
    count: matchCount,
    probability: matchCount / draws,
  };
}

// Query functions for vampire attributes
export function simulateWithQuery(deck, vampireData, draws, handSize, query) {
  const deckSize = deck.length;
  const working = [...deck];
  let matchCount = 0;

  for (let i = 0; i < draws; i++) {
    for (let j = 0; j < deckSize; j++) working[j] = deck[j];
    shuffle(working);

    const hand = working.slice(0, handSize);

    // Check if hand satisfies the query
    if (checkHandQuery(hand, vampireData, query)) {
      matchCount++;
    }
  }

  return {
    count: matchCount,
    probability: matchCount / draws,
  };
}

function checkHandQuery(hand, vampireData, query) {
  const uniqueVampires = [...new Set(hand)];

  for (const vampireName of uniqueVampires) {
    const vampire = vampireData[vampireName];
    if (!vampire) continue;

    // Check if this vampire matches the query
    if (matchesQuery(vampire, query)) {
      return true;
    }
  }

  return false;
}

function matchesQuery(vampire, query) {
  // Check discipline - use case to determine level (POT=superior, pot=inferior)
  if (query.discipline) {
    const disc = query.discipline;
    const isUpperCase = disc === disc.toUpperCase();
    const discNormalized = disc.toUpperCase();

    if (isUpperCase) {
      // Looking for superior discipline (e.g., POT) - only matches superior
      if (!vampire.disciplines.superior.includes(discNormalized)) return false;
    } else {
      // Looking for inferior discipline (e.g., pot) - matches inferior OR superior
      // (vampires with superior can play cards requiring inferior)
      const hasInferior = vampire.disciplines.inferior.includes(discNormalized);
      const hasSuperior = vampire.disciplines.superior.includes(discNormalized);
      if (!hasInferior && !hasSuperior) return false;
    }
  }

  // Check capacity
  if (query.minCapacity !== undefined && vampire.capacity < query.minCapacity)
    return false;
  if (query.maxCapacity !== undefined && vampire.capacity > query.maxCapacity)
    return false;

  // Check title
  if (query.title && vampire.title.toLowerCase() !== query.title.toLowerCase())
    return false;

  // Check clan
  if (query.clan && vampire.clan.toLowerCase() !== query.clan.toLowerCase())
    return false;

  return true;
}
