// VTES Crypt Draw Simulator - UI Module

const DRAWS = 10000;
const HAND_SIZE = 4;

function parseCrypt(text) {
  const deck = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.trim() || line.startsWith("Crypt") || line.startsWith("==="))
      continue;

    const m = line.match(/^\s*(\d+)\s*x\s+(.+)/i);
    if (!m) continue;

    const count = parseInt(m[1]);
    const rest = m[2].trim();
    const nameMatch = rest.match(/^(.+?)\s{2,}\d/);
    const name = nameMatch
      ? nameMatch[1].trim()
      : rest.split(/\s{2,}/)[0].trim();

    for (let i = 0; i < count; i++) {
      deck.push(name);
    }
  }

  return deck;
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

function runSimulation(text) {
  const deck = parseCrypt(text);

  if (deck.length === 0) {
    return { error: "No vampires parsed. Check input format." };
  }

  const { diversityCounts, appearanceCounts, uniqueNames } = simulate(
    deck,
    DRAWS,
    HAND_SIZE,
  );

  // Calculate copy counts
  const copyCounts = {};
  deck.forEach((n) => (copyCounts[n] = (copyCounts[n] || 0) + 1));

  // Sort vampires by appearance probability
  const sortedVampires = [...uniqueNames].sort(
    (a, b) => appearanceCounts[b] - appearanceCounts[a],
  );

  return {
    deck,
    deckSize: deck.length,
    handSize: HAND_SIZE,
    draws: DRAWS,
    diversity: diversityCounts,
    vampires: sortedVampires.map((name) => ({
      name,
      copies: copyCounts[name],
      appearances: appearanceCounts[name],
      probability: appearanceCounts[name] / DRAWS,
    })),
  };
}

function calculateSpecificCombination(deck, targetVampires, draws, handSize) {
  if (targetVampires.length !== 4) {
    return null;
  }

  let matchCount = 0;
  const deckSize = deck.length;
  const working = [...deck];

  // Sort target for comparison
  const sortedTarget = [...targetVampires].sort();

  for (let i = 0; i < draws; i++) {
    for (let j = 0; j < deckSize; j++) working[j] = deck[j];
    shuffle(working);

    const hand = working.slice(0, handSize);
    const sortedHand = [...hand].sort();

    // Check if the hand matches the target exactly (including duplicates)
    if (sortedHand.every((v, idx) => v === sortedTarget[idx])) {
      matchCount++;
    }
  }

  return {
    count: matchCount,
    probability: matchCount / draws,
  };
}
