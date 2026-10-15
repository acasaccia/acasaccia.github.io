// Unit tests for the crypt query language.
// Run with: node --test vtes-crypt-simulator/tests/*.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseQuery, compileQuery } from "../query.js";
import { runSimulation, simulateWithQuery } from "../simulation.js";

const CRYPT = `Crypt (12 cards)
================
3x Anson            8 AUS DOM PRE for   prince        Toreador:4
2x Lodin            9 DOM POT pre tha   prince        Ventrue:4
2x Arika            11 AUS DOM ANI   inner circle  Ventrue:2
3x Small Fry        3 pot             Brujah:6
2x Ur-Shulgi, Mesu  4 obf pot         baron         Daughter of Cacophony:6

Library (1 card)
1x Something
`;

const data = runSimulation(CRYPT);

const A = "Anson";
const L = "Lodin";
const R = "Arika";
const S = "Small Fry";
const U = "Ur-Shulgi, Mesu";

function matches(query, hand) {
  return compileQuery(parseQuery(query), data.vampireData)(hand);
}

function probability(query) {
  const predicate = compileQuery(parseQuery(query), data.vampireData);
  return simulateWithQuery(data.deck, 20000, data.handSize, predicate)
    .probability;
}

function cases(list) {
  for (const [query, hand, expected] of list) {
    it(`${query} [${hand.join(" | ")}] → ${expected}`, () => {
      assert.equal(matches(query, hand), expected);
    });
  }
}

describe("quantifiers", () => {
  cases([
    ["any where title = any", [S, S, S, A], true],
    ["any where title = any", [S, S, S, S], false],
    ["no vampire where title = any", [S, S, S, S], true],
    ["no vampire where title = any", [S, S, A, S], false],
    ["at least 2 distinct where title = any", [A, A, L, S], true],
    ["at least 3 distinct where title = any", [A, A, L, S], false],
    ["at most 1 distinct where title = any", [A, A, S, S], true],
    ["exactly 1 where name = Anson", [A, L, S, S], true],
    ["exactly 1 where name = Anson", [A, A, S, S], false],
    ["AT LEAST 1 WHERE CLAN = brujah", [S, A, A, A], true],
  ]);
});

describe("distinct vs copies", () => {
  cases([
    ["at least 2 distinct where title = none", [S, S, A, L], false],
    ["at least 2 where title = none", [S, S, A, L], true],
    ["at most 1 where title = any", [A, A, S, S], false],
    ["at least 2 distinct vampires where title = baron", [U, U, S, S], false],
  ]);
});

describe("title", () => {
  cases([
    ["any where title = inner circle", [R, S, S, S], true],
    ["any where title = prince", [R, S, S, S], false],
    ["any where title != prince", [A, A, L, L], false],
    ["any where not title = any", [A, A, A, S], true],
    ["any where title in (none, baron)", [A, A, L, U], true],
    ["any where title in (none, baron)", [A, A, L, R], false],
  ]);
});

describe("name and clan", () => {
  cases([
    ['any where name = "Ur-Shulgi, Mesu"', [U, S, S, S], true],
    ['any where name ~ "shulgi"', [U, S, S, S], true],
    ["any where clan = Daughter of Cacophony", [U, S, S, S], true],
    ["any where clan in (Toreador, Brujah)", [L, L, R, S], true],
    ["any where clan in (Toreador, Brujah)", [L, L, R, U], false],
  ]);
});

describe("capacity", () => {
  cases([
    ["any where cap = 3", [S, A, A, A], true],
    ["any where cap < 4", [U, A, A, A], false],
    ["any where cap <= 4", [U, A, A, A], true],
    ["any where cap > 9", [L, A, A, A], false],
    ["any where capacity >= 9", [L, A, A, A], true],
    ["any where cap != 8", [A, A, A, A], false],
  ]);
});

describe("disciplines", () => {
  cases([
    // Small Fry has inferior pot only
    ["any where disc = POT", [A, S, S, R], false],
    ["any where disc = POT", [L, S, S, R], true],
    ["any where disc = pot", [S, S, S, A], true],
    ["any where discipline in (THA, tha)", [L, S, S, S], true],
  ]);
});

describe("boolean composition", () => {
  cases([
    ["any where clan != Ventrue and cap >= 8", [A, L, R, S], true],
    ["any where clan != Ventrue and cap >= 8", [L, R, S, U], false],
    [
      "any where disc = DOM and (title in (prince, justicar) or cap > 9)",
      [R, S, S, S],
      true,
    ],
    [
      "any where disc = DOM and (title in (prince, justicar) or cap > 9)",
      [S, S, S, U],
      false,
    ],
    [
      "at least 1 where clan = Brujah and at least 1 where clan = Ventrue",
      [S, L, A, A],
      true,
    ],
    [
      "at least 1 where clan = Brujah and at least 1 where clan = Ventrue",
      [S, A, A, A],
      false,
    ],
    [
      'any where name = "Anson" or at least 2 distinct where cap <= 4',
      [S, U, L, L],
      true,
    ],
    [
      'any where name = "Anson" or at least 2 distinct where cap <= 4',
      [S, S, L, L],
      false,
    ],
    ["not any where title = any", [S, S, S, S], true],
    [
      "(any where name = Anson or any where name = Lodin) and no vampire where cap < 5",
      [A, R, R, R],
      true,
    ],
    [
      "(any where name = Anson or any where name = Lodin) and no vampire where cap < 5",
      [A, R, R, S],
      false,
    ],
    [
      "any where title = any and not at least 1 where cap <= 3",
      [A, A, U, U],
      true,
    ],
  ]);
});

describe("parse errors", () => {
  const errors = [
    ["", /Please enter a query/],
    ["at least where title = any", /whole number after "at least"/],
    ["at most where cap = 3", /whole number after "at most"/],
    ["at least 2", /Expected "where"/],
    ["any where", /Expected a filter/],
    ["any where colour = red", /found "colour"/],
    ["any where cap = big", /whole number after "cap"/],
    ["any where cap ~ 3", /one of = != < <= > >= after "cap"/],
    ["any where disc ~ POT", /one of = != in after "disc"/],
    ["any where title = any and", /Expected a filter/],
    ["any where (title = any", /Expected "\)"/],
    ["any where clan in (Brujah", /Expected "\)"/],
    ["foo", /Expected "at least N"/],
    ['any where title = "x', /Unexpected character/],
    ["any where title = any )", /Expected "and", "or" or end of query/],
  ];

  for (const [query, message] of errors) {
    it(`rejects ${JSON.stringify(query)}`, () => {
      assert.throws(() => parseQuery(query), message);
    });
  }
});

describe("simulation", () => {
  it("never draws a hand without titled vampires (only 3 untitled cards)", () => {
    assert.equal(probability("no vampire where title = any"), 0);
    assert.equal(probability("any where title = any"), 1);
  });

  it("approximates the exact probability of missing a vampire", () => {
    // P(no Small Fry) = C(9,4) / C(12,4)
    const exact = (9 * 8 * 7 * 6) / (12 * 11 * 10 * 9);
    const p = probability("no vampire where name = Small Fry");
    assert.ok(Math.abs(p - exact) < 0.02, `got ${p}, expected ~${exact}`);
  });
});
