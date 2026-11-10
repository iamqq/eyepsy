import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentSchema } from "../schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.resolve(__dirname, "../../src/data/content.json");

function readContent() {
  return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

test("the current content.json matches the schema", () => {
  const result = contentSchema.safeParse(readContent());
  assert.equal(
    result.success,
    true,
    result.success ? "" : JSON.stringify(result.error.issues, null, 2),
  );
});

test("certificates.items may be empty so deletion via JSON works", () => {
  const data = readContent();
  data.certificates.items = [];
  assert.equal(contentSchema.safeParse(data).success, true);
});

test("unknown top-level fields are rejected", () => {
  const data = readContent();
  data.unknown = true;
  assert.equal(contentSchema.safeParse(data).success, false);
});

test("unknown footer placeholders are rejected", () => {
  const data = readContent();
  data.site.footer.note = "Текст с неизвестным плейсхолдером {unknown}";
  assert.equal(contentSchema.safeParse(data).success, false);
});

test("certificate openLabel must contain the title placeholder", () => {
  const data = readContent();
  data.certificates.openLabel = "Открыть";
  assert.equal(contentSchema.safeParse(data).success, false);
});

test("duplicate certificate image paths are rejected", () => {
  const data = readContent();
  data.certificates.items = [
    { src: "/images/certificates/ulyana/u1.webp", title: "Один" },
    { src: "/images/certificates/ulyana/u1.webp", title: "Два" },
  ];
  assert.equal(contentSchema.safeParse(data).success, false);
});

test("missing required person fields are rejected", () => {
  const data = readContent();
  delete data.person.name;
  assert.equal(contentSchema.safeParse(data).success, false);
});
