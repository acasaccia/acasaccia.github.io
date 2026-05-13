// VTES Crypt Simulator - UI Renderer using htm/preact
import { html, render } from "https://esm.sh/htm/preact/standalone";

// Component: Error Message
const ErrorMessage = ({ error }) => html`
  <div>
    <p class="error">${error}</p>
    <p>
      Expected format:<br />2x Vampire Name 7 POT PRE<br />1x Another Name 5 cel
    </p>
  </div>
`;

// Component: Statistics Section
const Stats = ({ data }) => html`
  <div class="stats">
    <p><strong>Crypt size:</strong> ${data.deckSize} cards</p>
    <p><strong>Hand size:</strong> ${data.handSize}</p>
    <p><strong>Draws:</strong> ${data.draws.toLocaleString()}</p>
    <p><strong>Simulation time:</strong> ${data.simulationTime.toFixed(1)}ms</p>
  </div>
`;

// Component: Distribution Bar
const DistributionBar = ({ probability }) => {
  const barWidth = Math.round(probability * 200);
  return html`
    <div class="bar-container">
      <div class="bar" style="width: ${barWidth}px"></div>
    </div>
  `;
};

// Component: Diversity Table
const DiversityTable = ({ data }) => html`
  <div>
    <h2>Distinct Vampires in Opening Hand</h2>
    <table>
      <thead>
        <tr>
          <th>Distinct</th>
          <th>Count</th>
          <th>Probability</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${[1, 2, 3, 4].map((d) => {
          const count = data.diversity[d] || 0;
          const prob = ((count / data.draws) * 100).toFixed(2);
          return html`
            <tr key=${d}>
              <td>${d}</td>
              <td>${count.toLocaleString()}</td>
              <td>${prob}%</td>
              <td>${DistributionBar({ probability: count / data.draws })}</td>
            </tr>
          `;
        })}
      </tbody>
    </table>
  </div>
`;

// Component: Quantity Control with +/- buttons
const QuantityControl = ({ name, onQuantityChange }) => {
  const handleDecrement = (e) => {
    const input = e.target.parentElement.querySelector(".vamp-quantity");
    const newValue = Math.max(0, parseInt(input.value || 0) - 1);
    input.value = newValue;
    onQuantityChange({ target: input });
  };

  const handleIncrement = (e) => {
    const input = e.target.parentElement.querySelector(".vamp-quantity");
    const newValue = Math.min(4, parseInt(input.value || 0) + 1);
    input.value = newValue;
    onQuantityChange({ target: input });
  };

  const handleInputChange = (e) => {
    // Ensure value stays within bounds
    let value = parseInt(e.target.value || 0);
    value = Math.max(0, Math.min(4, value));
    e.target.value = value;
    onQuantityChange(e);
  };

  return html`
    <div class="quantity-control">
      <button
        type="button"
        class="qty-btn qty-minus"
        onClick=${handleDecrement}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        min="0"
        max="4"
        value="0"
        class="vamp-quantity"
        data-name="${name}"
        onInput=${handleInputChange}
      />
      <button
        type="button"
        class="qty-btn qty-plus"
        onClick=${handleIncrement}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  `;
};

// Component: Vampire Row in Table
const VampireRow = ({ vampire, onQuantityChange }) => {
  const prob = (vampire.probability * 100).toFixed(2);

  // Format disciplines
  const supDisc = vampire.disciplines?.superior?.join(" ") || "";
  const infDisc =
    vampire.disciplines?.inferior?.map((d) => d.toLowerCase()).join(" ") || "";
  const disciplines = [supDisc, infDisc].filter((d) => d).join(" ");

  return html`
    <tr>
      <td class="quantity-cell">
        <${QuantityControl}
          name=${vampire.name}
          onQuantityChange=${onQuantityChange}
        />
      </td>
      <td>${vampire.name}</td>
      <td>${vampire.capacity || ""}</td>
      <td style="font-size: 11px;">${disciplines}</td>
      <td>${vampire.title || ""}</td>
      <td>${vampire.clan || ""}</td>
      <td>${vampire.copies}x</td>
      <td>${vampire.appearances.toLocaleString()}</td>
      <td>${prob}%</td>
      <td>${DistributionBar({ probability: vampire.probability })}</td>
    </tr>
  `;
};

// Component: Vampire Table
const VampireTable = ({ data, onQuantityChange }) => html`
  <div>
    <h2>Probability of Each Vampire Appearing in Hand</h2>
    <p style="margin-bottom: 10px;">
      <em
        >Enter quantities (1-4 total) to calculate the probability of drawing at
        least those vampires:</em
      >
    </p>
    <table>
      <thead>
        <tr>
          <th class="quantity-cell">Qty</th>
          <th>Vampire</th>
          <th>Cap</th>
          <th>Disciplines</th>
          <th>Title</th>
          <th>Clan</th>
          <th>Copies</th>
          <th>Count</th>
          <th>Probability</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${data.vampires.map((vampire) =>
          VampireRow({ vampire, onQuantityChange }),
        )}
      </tbody>
    </table>
  </div>
`;

// Component: Specific Combo Result
const SpecificComboResult = ({ selected, total, result, draws }) => {
  if (total === 0) return null;

  const selectedText = selected.map((s) => `${s.qty}x ${s.name}`).join(", ");

  if (total > 4) {
    return html`
      <div class="specific-combo">
        <h2>Specific Combination</h2>
        <p>Total: ${total} vampires. Maximum is 4 (hand size).</p>
        <p class="selected-list">Currently selected: ${selectedText}</p>
      </div>
    `;
  }

  const prob = (result.probability * 100).toFixed(2);
  const exactOrAtLeast = total === 4 ? "exactly" : "at least";

  return html`
    <div class="specific-combo">
      <h2>Specific Combination Probability</h2>
      <p class="selected-list">Target: ${selectedText}</p>
      <p class="result">
        Probability of opening with ${exactOrAtLeast} this combination: ${prob}%
      </p>
      <p>
        Occurred in ${result.count.toLocaleString()} out of
        ${draws.toLocaleString()} draws
      </p>
    </div>
  `;
};

// Component: Query Result
const QueryResult = ({ query, result, draws }) => {
  if (!query) return null;

  const prob = (result.probability * 100).toFixed(2);

  // Build query description
  const queryParts = [];
  if (query.discipline) {
    let discText = query.discipline.toUpperCase();
    if (query.disciplineLevel === "superior") discText += " (superior only)";
    else if (query.disciplineLevel === "inferior") discText += " (any level)";
    queryParts.push(`discipline: ${discText}`);
  }
  if (query.minCapacity !== undefined && query.maxCapacity !== undefined) {
    queryParts.push(`capacity: ${query.minCapacity}-${query.maxCapacity}`);
  } else if (query.minCapacity !== undefined) {
    queryParts.push(`capacity ≥ ${query.minCapacity}`);
  } else if (query.maxCapacity !== undefined) {
    queryParts.push(`capacity ≤ ${query.maxCapacity}`);
  }
  if (query.title) queryParts.push(`title: ${query.title}`);
  if (query.clan) queryParts.push(`clan: ${query.clan}`);

  const queryDesc = queryParts.join(", ");

  return html`
    <div class="specific-combo">
      <h2>Query Result</h2>
      <p class="selected-list">At least 1 vampire with: ${queryDesc}</p>
      <p class="result">Probability: ${prob}%</p>
      <p>
        Occurred in ${result.count.toLocaleString()} out of
        ${draws.toLocaleString()} draws
      </p>
    </div>
  `;
};

// Main render function
export function renderResults(data, outputElement, onQuantityChange) {
  if (data.error) {
    render(html`<${ErrorMessage} error=${data.error} />`, outputElement);
    return;
  }

  render(
    html`
      <div>
        <${Stats} data=${data} />
        <${DiversityTable} data=${data} />
        <${VampireTable} data=${data} onQuantityChange=${onQuantityChange} />
        <div id="specific-combo-result"></div>
      </div>
    `,
    outputElement,
  );
}

export function renderSpecificCombo(selected, total, result, draws) {
  const container = document.getElementById("specific-combo-result");
  if (container) {
    render(
      html`<${SpecificComboResult}
        selected=${selected}
        total=${total}
        result=${result}
        draws=${draws}
      />`,
      container,
    );
  }
}

export function renderQueryResult(query, result, draws) {
  const container = document.getElementById("queryResult");
  if (container) {
    render(
      html`<${QueryResult} query=${query} result=${result} draws=${draws} />`,
      container,
    );
  }
}

export function clearQueryResult() {
  const container = document.getElementById("queryResult");
  if (container) {
    render(null, container);
  }
}

export function renderEmptyState(container) {
  render(html`<p>Enter crypt data to see simulation results...</p>`, container);
}

export function renderError(container, message) {
  render(html`<p class="error">${message}</p>`, container);
}
