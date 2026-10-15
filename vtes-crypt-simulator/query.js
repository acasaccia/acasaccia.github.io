// VTES Crypt Simulator - Query Language
//
// query      := handOr
// handOr     := handAnd ("or" handAnd)*
// handAnd    := handUnary ("and" handUnary)*
// handUnary  := "not" handUnary | "(" handOr ")" | handTerm
// handTerm   := quantifier ["distinct"] ["vampire" | "vampires"] "where" vampOr
// quantifier := "at least" N | "at most" N | "exactly" N | "no" | "any"
// vampOr     := vampAnd ("or" vampAnd)*
// vampAnd    := vampUnary ("and" vampUnary)*
// vampUnary  := "not" vampUnary | "(" vampOr ")" | field op value

const FIELDS = {
  cap: "cap",
  capacity: "cap",
  disc: "disc",
  discipline: "disc",
  disciplines: "disc",
  name: "name",
  title: "title",
  clan: "clan",
};

const FIELD_OPERATORS = {
  cap: ["=", "!=", "<", "<=", ">", ">="],
  disc: ["=", "!=", "in"],
  name: ["=", "!=", "~", "in"],
  title: ["=", "!=", "~", "in"],
  clan: ["=", "!=", "~", "in"],
};

const QUANTIFIER_STARTS = ["at", "exactly", "no", "any"];

function tokenize(text) {
  const tokens = [];
  const pattern =
    /\s+|"([^"]*)"|'([^']*)'|(<=|>=|!=|=|<|>|~)|([(),])|([^\s()=<>!~,"'][^\s()=<>!~,"]*)/gy;
  let match;

  while (pattern.lastIndex < text.length) {
    const start = pattern.lastIndex;
    match = pattern.exec(text);
    if (!match) {
      throw new Error(`Unexpected character "${text[start]}".`);
    }
    if (match[1] !== undefined || match[2] !== undefined) {
      tokens.push({ type: "string", value: match[1] ?? match[2] });
    } else if (match[3]) {
      tokens.push({ type: "op", value: match[3] });
    } else if (match[4]) {
      tokens.push({ type: "punct", value: match[4] });
    } else if (match[5]) {
      tokens.push({ type: "word", value: match[5] });
    }
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  isWord(token, ...words) {
    return (
      token?.type === "word" && words.includes(token.value.toLowerCase())
    );
  }

  isPunct(token, value) {
    return token?.type === "punct" && token.value === value;
  }

  describe(token) {
    return token ? `"${token.value}"` : "end of query";
  }

  fail(expected) {
    throw new Error(`Expected ${expected}, found ${this.describe(this.peek())}.`);
  }

  expectWord(word) {
    if (!this.isWord(this.peek(), word)) this.fail(`"${word}"`);
    this.pos++;
  }

  expectPunct(value) {
    if (!this.isPunct(this.peek(), value)) this.fail(`"${value}"`);
    this.pos++;
  }

  expectNumber(context) {
    const token = this.peek();
    if (token?.type !== "word" || !/^\d+$/.test(token.value)) {
      this.fail(`a whole number after ${context}`);
    }
    this.pos++;
    return parseInt(token.value);
  }

  // Lookahead: does a hand term (optionally behind "not" / "(") start here?
  isHandTermStart(offset) {
    let token = this.peek(offset);
    while (this.isWord(token, "not") || this.isPunct(token, "(")) {
      token = this.peek(++offset);
    }
    return this.isWord(token, ...QUANTIFIER_STARTS);
  }

  parse() {
    if (this.tokens.length === 0) throw new Error("Please enter a query.");
    const node = this.parseHandOr();
    if (this.peek()) this.fail('"and", "or" or end of query');
    return node;
  }

  parseHandOr() {
    let node = this.parseHandAnd();
    while (this.isWord(this.peek(), "or")) {
      this.pos++;
      node = { type: "or", left: node, right: this.parseHandAnd() };
    }
    return node;
  }

  parseHandAnd() {
    let node = this.parseHandUnary();
    while (this.isWord(this.peek(), "and")) {
      this.pos++;
      node = { type: "and", left: node, right: this.parseHandUnary() };
    }
    return node;
  }

  parseHandUnary() {
    if (this.isWord(this.peek(), "not")) {
      this.pos++;
      return { type: "not", operand: this.parseHandUnary() };
    }
    if (this.isPunct(this.peek(), "(")) {
      this.pos++;
      const node = this.parseHandOr();
      this.expectPunct(")");
      return node;
    }
    return this.parseHandTerm();
  }

  parseHandTerm() {
    const token = this.peek();
    let quantifier;
    let n = 1;

    if (this.isWord(token, "at")) {
      this.pos++;
      if (this.isWord(this.peek(), "least")) quantifier = "least";
      else if (this.isWord(this.peek(), "most")) quantifier = "most";
      else this.fail('"least" or "most" after "at"');
      this.pos++;
      n = this.expectNumber(`"at ${quantifier}"`);
    } else if (this.isWord(token, "exactly")) {
      this.pos++;
      quantifier = "exactly";
      n = this.expectNumber('"exactly"');
    } else if (this.isWord(token, "no", "any")) {
      this.pos++;
      quantifier = token.value.toLowerCase();
    } else {
      this.fail('"at least N", "at most N", "exactly N", "no" or "any"');
    }

    let distinct = false;
    if (this.isWord(this.peek(), "distinct")) {
      this.pos++;
      distinct = true;
    }
    if (this.isWord(this.peek(), "vampire", "vampires")) this.pos++;
    this.expectWord("where");

    return {
      type: "count",
      quantifier,
      n,
      distinct,
      filter: this.parseVampOr(),
    };
  }

  parseVampOr() {
    let node = this.parseVampAnd();
    while (this.isWord(this.peek(), "or") && !this.isHandTermStart(1)) {
      this.pos++;
      node = { type: "or", left: node, right: this.parseVampAnd() };
    }
    return node;
  }

  parseVampAnd() {
    let node = this.parseVampUnary();
    while (this.isWord(this.peek(), "and") && !this.isHandTermStart(1)) {
      this.pos++;
      node = { type: "and", left: node, right: this.parseVampUnary() };
    }
    return node;
  }

  parseVampUnary() {
    if (this.isWord(this.peek(), "not")) {
      this.pos++;
      return { type: "not", operand: this.parseVampUnary() };
    }
    if (this.isPunct(this.peek(), "(")) {
      this.pos++;
      const node = this.parseVampOr();
      this.expectPunct(")");
      return node;
    }
    return this.parseComparison();
  }

  parseComparison() {
    const fieldToken = this.peek();
    const field =
      fieldToken?.type === "word" && FIELDS[fieldToken.value.toLowerCase()];
    if (!field) this.fail("a filter (cap, disc, name, title or clan)");
    this.pos++;

    const opToken = this.peek();
    let operator;
    if (opToken?.type === "op") operator = opToken.value;
    else if (this.isWord(opToken, "in")) operator = "in";
    if (!operator || !FIELD_OPERATORS[field].includes(operator)) {
      this.fail(
        `one of ${FIELD_OPERATORS[field].join(" ")} after "${fieldToken.value}"`,
      );
    }
    this.pos++;

    let values;
    if (operator === "in") {
      this.expectPunct("(");
      values = [this.parseValue(field)];
      while (this.isPunct(this.peek(), ",")) {
        this.pos++;
        values.push(this.parseValue(field));
      }
      this.expectPunct(")");
    } else {
      values = [this.parseValue(field)];
    }

    return { type: "compare", field, operator, values };
  }

  // A value is a quoted string or a run of bare words (e.g. inner circle),
  // stopping at "and" / "or" / punctuation.
  parseValue(field) {
    if (field === "cap") return this.expectNumber('"cap"');

    const token = this.peek();
    if (token?.type === "string") {
      this.pos++;
      return token.value;
    }

    const words = [];
    while (
      this.peek()?.type === "word" &&
      !this.isWord(this.peek(), "and", "or")
    ) {
      words.push(this.peek().value);
      this.pos++;
    }
    if (words.length === 0) this.fail(`a value for "${field}"`);
    return words.join(" ");
  }
}

function hasDiscipline(vampire, disc) {
  const code = disc.toUpperCase();
  // POT = superior only; pot = inferior or superior
  if (disc === code) return vampire.disciplines.superior.includes(code);
  return (
    vampire.disciplines.inferior.includes(code) ||
    vampire.disciplines.superior.includes(code)
  );
}

function matchesValue(vampire, field, operator, value) {
  if (field === "disc") return hasDiscipline(vampire, value);

  const actual = vampire[field].toLowerCase();
  const expected = value.toLowerCase();

  if (field === "title") {
    if (expected === "any") return actual !== "";
    if (expected === "none") return actual === "";
  }
  if (operator === "~") return actual.includes(expected);
  return actual === expected;
}

function evaluateFilter(node, vampire) {
  switch (node.type) {
    case "and":
      return evaluateFilter(node.left, vampire) && evaluateFilter(node.right, vampire);
    case "or":
      return evaluateFilter(node.left, vampire) || evaluateFilter(node.right, vampire);
    case "not":
      return !evaluateFilter(node.operand, vampire);
  }

  const { field, operator, values } = node;

  if (field === "cap") {
    const cap = vampire.capacity;
    const n = values[0];
    switch (operator) {
      case "=": return cap === n;
      case "!=": return cap !== n;
      case "<": return cap < n;
      case "<=": return cap <= n;
      case ">": return cap > n;
      case ">=": return cap >= n;
    }
  }

  const matched = values.some((v) => matchesValue(vampire, field, operator, v));
  return operator === "!=" ? !matched : matched;
}

// Compile a parsed query into a (hand) => boolean predicate. Vampire filters
// are evaluated once per vampire here, so each draw only counts names.
function compile(node, vampireData) {
  switch (node.type) {
    case "and": {
      const left = compile(node.left, vampireData);
      const right = compile(node.right, vampireData);
      return (hand) => left(hand) && right(hand);
    }
    case "or": {
      const left = compile(node.left, vampireData);
      const right = compile(node.right, vampireData);
      return (hand) => left(hand) || right(hand);
    }
    case "not": {
      const operand = compile(node.operand, vampireData);
      return (hand) => !operand(hand);
    }
  }

  const matching = new Set(
    Object.values(vampireData)
      .filter((vampire) => evaluateFilter(node.filter, vampire))
      .map((vampire) => vampire.name),
  );
  const { quantifier, n, distinct } = node;

  return (hand) => {
    let count = 0;
    for (let i = 0; i < hand.length; i++) {
      if (!matching.has(hand[i])) continue;
      if (distinct && hand.indexOf(hand[i]) !== i) continue;
      count++;
    }
    switch (quantifier) {
      case "least": return count >= n;
      case "most": return count <= n;
      case "exactly": return count === n;
      case "no": return count === 0;
      case "any": return count >= 1;
    }
  };
}

export function parseQuery(text) {
  return new Parser(tokenize(text)).parse();
}

export function compileQuery(ast, vampireData) {
  return compile(ast, vampireData);
}
