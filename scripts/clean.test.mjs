import assert from "node:assert/strict";
import test from "node:test";
import { cleanText, parseValue, toAirdate } from "./clean.mjs";

test("strips the dataset's wrapping quotes and html", () => {
  const question = cleanText(
    `'<a href="http://www.j-archive.com/media/clip.mp3">Beyond ovoid abandonment, he "Hatches the Egg"</a>'`,
    { unwrapQuotes: true }
  );
  assert.equal(question, 'Beyond ovoid abandonment, he "Hatches the Egg"');
});

test("keeps apostrophes inside a wrapped question", () => {
  const question = cleanText(
    `'For the last 8 years of his life, Galileo was under house arrest for espousing this man's theory'`,
    { unwrapQuotes: true }
  );
  assert.equal(
    question,
    "For the last 8 years of his life, Galileo was under house arrest for espousing this man's theory"
  );
});

test("parses dollar values and treats final jeopardy as null", () => {
  assert.equal(parseValue("$1,000"), 1000);
  assert.equal(parseValue("$200"), 200);
  assert.equal(parseValue(null), null);
  assert.equal(parseValue("None"), null);
});

test("normalizes airdates to the jService timestamp shape", () => {
  assert.equal(toAirdate("2004-12-31"), "2004-12-31T12:00:00.000Z");
  assert.equal(toAirdate(""), null);
});
