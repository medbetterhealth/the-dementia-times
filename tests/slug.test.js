import test from "node:test";
import assert from "node:assert/strict";
import { slugifyTitle } from "../src/lib/slug.js";

test("slugifyTitle creates stable lowercase URL slugs", () => {
  assert.equal(
    slugifyTitle("Why Does Eating Become So Hard in Dementia?"),
    "why-does-eating-become-so-hard-in-dementia"
  );
});

test("slugifyTitle removes punctuation and collapses repeated separators", () => {
  assert.equal(
    slugifyTitle("The 4PM Reset: Preventing the Dementia Sundowning Spiral Before It Starts"),
    "the-4pm-reset-preventing-the-dementia-sundowning-spiral-before-it-starts"
  );
});
