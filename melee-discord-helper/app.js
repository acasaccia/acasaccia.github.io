import {
  createClient,
  formatParticipants,
  formatPairings,
  formatStandings,
  splitMessage,
} from "./melee.js";

// CORS proxy for the Melee.gg API (see proxy/README.md)
const PROXY_URL = "https://melee-proxy.acasaccia.workers.dev";

// Non-secret preferences, always persisted.
const SETTINGS_KEY = "mdh.settings";
// Secrets, persisted only when the user clicks "Save".
const CREDENTIALS_KEY = "mdh.credentials";

const formatters = {
  participants: formatParticipants,
  pairings: formatPairings,
  standings: formatStandings,
};

const $ = (id) => document.getElementById(id);
const settingsPanel = $("settings");
const clientIdInput = $("clientId");
const clientSecretInput = $("clientSecret");
const saveButton = $("saveCredentials");
const forgetButton = $("clearCredentials");
const saveStatus = $("saveStatus");
const tournamentIdInput = $("tournamentId");
const outputDiv = $("output");
const commandButtons = document.querySelectorAll(".btn-command");

let currentRequest = null;

// localStorage may be unavailable (private mode, blocked storage)
const storage = {
  read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

function loadState() {
  const settings = storage.read(SETTINGS_KEY) || {};
  const credentials = storage.read(CREDENTIALS_KEY);

  tournamentIdInput.value = settings.tournamentId || "";

  if (credentials) {
    clientIdInput.value = credentials.clientId || "";
    clientSecretInput.value = credentials.clientSecret || "";
  }

  settingsPanel.open = !hasSettings();
  updateSaveStatus();
}

function saveSettings() {
  storage.write(SETTINGS_KEY, {
    tournamentId: tournamentIdInput.value.trim(),
  });
}

function currentCredentials() {
  return {
    clientId: clientIdInput.value.trim(),
    clientSecret: clientSecretInput.value.trim(),
  };
}

function updateSaveStatus(message) {
  const stored = storage.read(CREDENTIALS_KEY);
  const current = currentCredentials();
  const hasInput = Boolean(current.clientId || current.clientSecret);
  const isSaved =
    stored !== null &&
    stored.clientId === current.clientId &&
    stored.clientSecret === current.clientSecret;

  if (message) {
    saveStatus.textContent = message;
  } else if (isSaved) {
    saveStatus.textContent = "✓ Saved in this browser";
  } else if (stored) {
    saveStatus.textContent = "Unsaved changes";
  } else {
    saveStatus.textContent = "Not saved: kept in this tab only";
  }

  saveButton.disabled =
    isSaved || !current.clientId || !current.clientSecret;
  forgetButton.disabled = stored === null && !hasInput;
}

function saveCredentials() {
  const saved = storage.write(CREDENTIALS_KEY, currentCredentials());
  updateSaveStatus(
    saved ? undefined : "Could not save: browser storage is unavailable",
  );
}

function forgetCredentials() {
  clientIdInput.value = "";
  clientSecretInput.value = "";
  storage.remove(CREDENTIALS_KEY);
  settingsPanel.open = true;
  updateSaveStatus();
}

function hasSettings() {
  return Boolean(clientIdInput.value.trim() && clientSecretInput.value.trim());
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message) {
  outputDiv.replaceChildren(el("div", "error", message));
}

function showLoading() {
  const loading = el("div", "loading");
  loading.append(el("div", "spinner"), "Loading...");
  outputDiv.replaceChildren(loading);
}

function flashFeedback(feedback) {
  feedback.classList.add("show");
  setTimeout(() => feedback.classList.remove("show"), 2000);
}

async function copyToClipboard(textarea, feedback) {
  try {
    await navigator.clipboard.writeText(textarea.value);
    flashFeedback(feedback);
    return;
  } catch (err) {
    console.log("Clipboard API failed, trying fallback:", err);
  }

  textarea.focus();
  textarea.select();
  if (document.execCommand("copy")) {
    flashFeedback(feedback);
  } else {
    alert("Failed to copy to clipboard");
  }
}

function renderParts(parts) {
  outputDiv.replaceChildren(
    ...parts.map((part, index) => {
      const wrapper = el("div", "message-part");
      const header = el("div", "part-header");
      const actions = el("div");
      const feedback = el("span", "copy-feedback", "Copied!");
      const copyButton = el(
        "button",
        "btn-copy-part",
        `📋 Copy Part ${index + 1}`,
      );
      const textarea = el("textarea", "output-textarea");

      copyButton.type = "button";
      textarea.readOnly = true;
      textarea.value = part;
      copyButton.addEventListener("click", () =>
        copyToClipboard(textarea, feedback),
      );

      actions.append(feedback, copyButton);
      header.append(el("span", "part-label", `Part ${index + 1}`), actions);
      wrapper.append(header, textarea);
      return wrapper;
    }),
  );
}

async function fetchData(command) {
  const tournamentId = tournamentIdInput.value.trim();

  if (!hasSettings()) {
    settingsPanel.open = true;
    showError("Please fill in the Client ID and Client Secret");
    return;
  }

  if (!tournamentId) {
    showError("Please enter a tournament ID");
    return;
  }

  if (currentRequest) {
    currentRequest.abort();
  }

  const controller = new AbortController();
  currentRequest = controller;

  commandButtons.forEach((btn) => (btn.disabled = true));
  showLoading();

  try {
    const client = createClient({
      proxyUrl: PROXY_URL,
      clientId: clientIdInput.value.trim(),
      clientSecret: clientSecretInput.value.trim(),
    });
    const result = await formatters[command](
      client,
      tournamentId,
      controller.signal,
    );

    if (result.error) {
      showError(result.error);
    } else {
      renderParts(splitMessage(result.message));
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    if (error instanceof TypeError) {
      showError(
        `Error: could not reach the proxy (${error.message}). Please try again later.`,
      );
    } else {
      showError(`Error: ${error.message}`);
    }
  } finally {
    if (currentRequest === controller) {
      commandButtons.forEach((btn) => (btn.disabled = false));
      currentRequest = null;
    }
  }
}

commandButtons.forEach((button) =>
  button.addEventListener("click", () => fetchData(button.dataset.command)),
);

tournamentIdInput.addEventListener("input", saveSettings);
clientIdInput.addEventListener("input", () => updateSaveStatus());
clientSecretInput.addEventListener("input", () => updateSaveStatus());
saveButton.addEventListener("click", saveCredentials);
forgetButton.addEventListener("click", forgetCredentials);

// Enter on the tournament ID defaults to participants
tournamentIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    fetchData("participants");
  }
});

loadState();
(settingsPanel.open ? clientIdInput : tournamentIdInput).focus();
