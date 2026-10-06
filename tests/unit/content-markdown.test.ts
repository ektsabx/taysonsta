import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksToMarkdown, markdownToBlocks, type Block } from "@/lib/yolias/content";

test("content Markdown round-trips to the site's blocks", () => {
  const blocks: Block[] = [
    { h2: "Getting started" }, { p: "Yolias has **no passwords**. See [pricing](/pricing)." }, { h3: "Steps" },
    { ol: ["Open the link", "Pick a plan"] }, { ul: ["One", "Two"] }, { note: "Links expire after an hour." },
    { table: { head: ["Plan", "Prospects"], rows: [["Free", "50"], ["Pro", "1,000"]] } }, { p: "نص عربي في فقرة." },
    { figure: { src: "/docs/shots/en-prospects.png", alt: "Prospects", caption: "The People tab", marks: [{ x: 12, y: 20.5, label: "Tabs" }, { x: 50, y: 40, label: "Select rows" }] } },
    { figure: { src: "/docs/shots/ar.png", alt: "صورة" } },
  ];
  assert.deepEqual(markdownToBlocks(blocksToMarkdown(blocks)), blocks);
  assert.deepEqual(markdownToBlocks("line one\nline two\n\nnext"), [{ p: "line one line two" }, { p: "next" }]);
});
