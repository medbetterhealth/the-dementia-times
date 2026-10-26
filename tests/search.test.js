import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildSearchIndex, searchCategoriesForIssue } from "../src/lib/search.js";
import { ui } from "../src/lib/ui-text.js";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const guides = JSON.parse(fs.readFileSync(path.join(rootDir, "content", "search-guides.json"), "utf8"));

function issue(slug, title, topics = []) {
  return { slug, title, topics };
}

test("search categories do not treat an unreviewed issue as dementia basics", () => {
  const categories = searchCategoriesForIssue(issue("unreviewed-community-update", "A Community Update"), guides);

  assert.deepEqual(categories, []);
});

test("search categories rely on curated membership instead of misleading title keywords", () => {
  const categories = searchCategoriesForIssue(
    issue(
      "the-one-resource-most-dementia-caregivers-overlook-and-it-s-not-a-medication",
      "The One Resource Most Dementia Caregivers Overlook (And It's Not a Medication)",
      ["Adult Day Care"]
    ),
    guides
  );

  assert.deepEqual(categories, ["caregiver-support"]);
});

test("the latest bathing issue is explicitly categorized as behavior and refusing help", () => {
  const categories = searchCategoriesForIssue(
    issue("why-does-bathing-become-a-battle-in-dementia", "Why Does Bathing Become a Battle in Dementia?"),
    guides
  );

  assert.deepEqual(categories.sort(), ["behavior", "refusing-help"]);
});

test("search index keeps relevant sections beyond the first five without leaking article-wide keywords into every snippet", () => {
  const sections = [
    ...Array.from({ length: 6 }, (_, index) => ({ type: "paragraph", text: `Generic introduction ${index + 1}.` })),
    { type: "heading", text: "Making bathing feel safer" },
    { type: "paragraph", text: "Warm the room and offer a towel before helping with the shower." }
  ];
  const [entry] = buildSearchIndex(
    [
      {
        slug: "late-shower-answer",
        title: "A Caregiver Guide",
        excerpt: "A broad guide for families.",
        topics: [],
        sections
      }
    ],
    []
  );

  assert.equal(entry.snippets.length, 7);
  assert.equal(entry.snippets.at(-1).heading, "Making bathing feel safer");
  assert.match(entry.snippets.at(-1).text, /shower/);
  assert.equal("searchText" in entry.snippets.at(-1), false);
  assert.doesNotMatch(entry.snippets[0].text, /shower/);
});

test("Russian article counts use the correct plural form", () => {
  const text = ui("ru");

  assert.equal(text.articlesCount(1), "1 статья");
  assert.equal(text.articlesCount(2), "2 статьи");
  assert.equal(text.articlesCount(5), "5 статей");
  assert.equal(text.articlesCount(11), "11 статей");
  assert.equal(text.articlesCount(22), "22 статьи");
});
