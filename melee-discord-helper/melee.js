// Melee.gg API client and Discord message formatters.
// Runs entirely in the browser: credentials are provided by the user and sent
// (as Basic Auth) only to the configured proxy, which forwards them to melee.gg.

// Discord's maximum message length is 2000; keep some margin.
export const DISCORD_MAX_LENGTH = 1800;

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function createClient({ proxyUrl, clientId, clientSecret }) {
  const baseUrl = proxyUrl.replace(/\/+$/, "");
  const authorization = `Basic ${toBase64(`${clientId}:${clientSecret}`)}`;

  async function get(path, signal) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Request failed: ${response.status} - check your Client ID and Client Secret`,
        );
      }
      const body = await response.text().catch(() => "");
      throw new Error(
        `Request failed: ${response.status}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    return response.json();
  }

  const id = (tournamentId) => encodeURIComponent(tournamentId);

  const client = {
    getParticipants: (tournamentId, signal) =>
      get(`/api/player/list/${id(tournamentId)}`, signal),
    getCurrentMatches: (tournamentId, signal) =>
      get(`/api/match/list/current/${id(tournamentId)}`, signal),
    getTournament: (tournamentId, signal) =>
      get(`/api/tournament/${id(tournamentId)}`, signal),
    getStandings: (tournamentId, signal) =>
      get(`/api/standing/list/current/${id(tournamentId)}`, signal),

    // Map of player ID -> { discord, deck } built from the participants list
    async getParticipantInfo(tournamentId, signal) {
      const participantsResponse = await client.getParticipants(
        tournamentId,
        signal,
      );
      const participantMap = new Map();

      (participantsResponse?.Content || []).forEach((player) => {
        participantMap.set(player.ID, {
          discord: discordName(player),
          deck: participantDeck(player),
        });
      });

      return participantMap;
    },
  };

  return client;
}

function discordName(player) {
  return player.DiscordUsername
    ? player.DiscordUsername.replace(/#\d+$/, "")
    : player.Username || "Unknown";
}

function participantDeck(player) {
  if (!player.Decklists || player.Decklists.length === 0) {
    return null;
  }
  const decklist = player.Decklists[0];
  return {
    name: decklist.AdminGivenName || decklist.DecklistName || "Unknown Deck",
    url: `https://melee.gg/Decklist/View/${decklist.Guid}`,
  };
}

// Deck info from the match itself, falling back to the participant list
// (first phase deck info)
function competitorDeck(competitor, player, participantMap) {
  if (competitor.Decklists && competitor.Decklists[0]) {
    const deck = competitor.Decklists[0];
    return {
      name: deck.DecklistName,
      url: `https://melee.gg/Decklist/View/${deck.DecklistId}`,
    };
  }
  return participantMap.get(player.ID)?.deck;
}

function competitorDisplay(competitor, participantMap) {
  const player = competitor.Team.Players[0];
  const deckInfo = competitorDeck(competitor, player, participantMap);
  const deckDisplay = deckInfo
    ? `([${deckInfo.name}](${deckInfo.url}))`
    : "(No deck info)";
  return `@${discordName(player)} ${deckDisplay}`;
}

export async function formatParticipants(client, tournamentId, signal) {
  const response = await client.getParticipants(tournamentId, signal);

  if (!response || !response.Content || response.Content.length === 0) {
    return { error: "No participants found for this tournament." };
  }

  let message = ":loudspeaker: **Tournament participants:** :loudspeaker:\n";
  response.Content.forEach((player) => {
    const deck = participantDeck(player);
    message += deck
      ? `- @${discordName(player)} - [${deck.name}](${deck.url})\n`
      : `- @${discordName(player)} - No decklist submitted\n`;
  });

  return { message };
}

export async function formatPairings(client, tournamentId, signal) {
  const [matchesResponse, participantMap, tournamentData] = await Promise.all([
    client.getCurrentMatches(tournamentId, signal),
    client.getParticipantInfo(tournamentId, signal),
    client.getTournament(tournamentId, signal),
  ]);

  if (
    !matchesResponse ||
    !matchesResponse.Content ||
    matchesResponse.Content.length === 0
  ) {
    return { error: "No current pairings found for this tournament." };
  }

  const firstMatch = matchesResponse.Content[0];
  const currentRoundNumber = firstMatch?.RoundNumber || 1;

  // Detect if we're in the second phase (double elimination bracket)
  let pairingTitle = `Round ${currentRoundNumber} Pairings`;
  if (tournamentData && tournamentData.Phases && firstMatch?.PhaseId) {
    const currentPhase = tournamentData.Phases.find(
      (phase) => phase.ID === firstMatch.PhaseId,
    );

    if (currentPhase) {
      const phaseIndex = tournamentData.Phases.indexOf(currentPhase);
      if (phaseIndex === 1) {
        pairingTitle = `Double Elimination Bracket`;
      } else {
        const totalRounds = currentPhase.Rounds
          ? currentPhase.Rounds.length
          : "?";
        pairingTitle = `Round ${currentRoundNumber} of ${totalRounds} Pairings`;
      }
    }
  }

  let message = `:loudspeaker: **${pairingTitle}** :loudspeaker:\n`;

  const byeMatches = [];
  const regularMatches = [];

  matchesResponse.Content.forEach((match) => {
    if (
      match.Competitors &&
      match.Competitors.length === 1 &&
      match.ByeReason !== null
    ) {
      byeMatches.push(match);
    } else if (match.Competitors && match.Competitors.length === 2) {
      regularMatches.push(match);
    }
  });

  // BYE matches first
  byeMatches.forEach((match) => {
    message += `- ${competitorDisplay(match.Competitors[0], participantMap)} - BYE\n`;
  });

  regularMatches.forEach((match) => {
    const player1Info = competitorDisplay(match.Competitors[0], participantMap);
    const player2Info = competitorDisplay(match.Competitors[1], participantMap);
    message += `- ${player1Info} vs ${player2Info}\n`;
  });

  return { message };
}

function formatRecord(wins = 0, losses = 0, draws = 0) {
  let record = `${wins}-${losses}`;
  if (draws > 0) {
    record += `-${draws}`;
  }
  return record;
}

export async function formatStandings(client, tournamentId, signal) {
  const [standingsResponse, tournamentData, participantMap] = await Promise.all(
    [
      client.getStandings(tournamentId, signal),
      client.getTournament(tournamentId, signal),
      client.getParticipantInfo(tournamentId, signal),
    ],
  );

  if (
    !standingsResponse ||
    !standingsResponse.Content ||
    standingsResponse.Content.length === 0
  ) {
    return { error: "No current standings found for this tournament." };
  }

  let currentRoundInfo = "Current";
  const currentRound = standingsResponse.Content[0]?.RoundNumber;
  if (currentRound) {
    const totalRounds = tournamentData?.Content?.NumberOfRounds;
    currentRoundInfo = totalRounds
      ? `After Round ${currentRound} of ${totalRounds}`
      : `After Round ${currentRound}`;
  }

  let message = `:loudspeaker: **Standings ${currentRoundInfo}** :loudspeaker:\n`;
  message += `\n`;
  message += `(Match record, Game record, OMW%)\n`;

  const sortedStandings = standingsResponse.Content.sort(
    (a, b) => (a.Rank || a.Position || 999) - (b.Rank || b.Position || 999),
  );

  sortedStandings.forEach((standing, index) => {
    const position = standing.Rank || standing.Position || index + 1;

    const playerId = standing.Team?.Players?.[0]?.ID;
    const discordHandle = playerId
      ? participantMap.get(playerId)?.discord
      : null;
    const playerName = discordHandle ? `@${discordHandle}` : "Unknown Player";

    const matchRecord = formatRecord(
      standing.MatchWins,
      standing.MatchLosses,
      standing.MatchDraws,
    );
    const gameRecord = formatRecord(
      standing.GameWins,
      standing.GameLosses,
      standing.GameDraws,
    );
    const omw = standing.OpponentMatchWinPercentage || 0;
    const omwPercentage = `${(omw * 100).toFixed(1)}%`;

    message += `${position}. ${playerName} (${matchRecord}, ${gameRecord}, ${omwPercentage})\n`;
  });

  return { message };
}

/**
 * Splits a message into chunks that fit within Discord's character limit.
 * Messages are split at newline boundaries to avoid breaking lines.
 */
export function splitMessage(message, maxLength = DISCORD_MAX_LENGTH) {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks = [];
  const lines = message.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    // A single line longer than maxLength is split at word boundaries
    if (line.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      let remainingLine = line;
      while (remainingLine.length > maxLength) {
        let splitIndex = maxLength;
        const lastSpace = remainingLine.lastIndexOf(" ", maxLength);
        if (lastSpace > maxLength / 2) {
          splitIndex = lastSpace;
        }
        chunks.push(remainingLine.substring(0, splitIndex));
        remainingLine = remainingLine.substring(splitIndex).trim();
      }

      if (remainingLine) {
        currentChunk = remainingLine + "\n";
      }
      continue;
    }

    const potentialChunk = currentChunk + line + "\n";
    if (potentialChunk.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
      }
      currentChunk = line + "\n";
    } else {
      currentChunk = potentialChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trimEnd());
  }

  return chunks;
}
