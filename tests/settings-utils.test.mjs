import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStatusIds, parseStatusIds } from "../src/lib/settings-utils.mjs";

test("parseStatusIds accepts commas, spaces, and new lines", () => {
  assert.deepEqual(parseStatusIds("84088646, 85285282\n900"), ["84088646", "85285282", "900"]);
});

test("normalizeStatusIds trims empty values and removes duplicates", () => {
  assert.deepEqual(normalizeStatusIds([" 84088646 ", "", "85285282", "84088646"]), ["84088646", "85285282"]);
});
