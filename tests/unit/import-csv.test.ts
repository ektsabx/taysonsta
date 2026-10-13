import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "@/lib/bos/import/csv";

test("csv: quoted fields, doubled quotes and commas inside quotes", () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""q"""\n1,2,3'), [["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
});
