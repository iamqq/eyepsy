import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  collectImagePaths,
  parseContentJson,
  validateContent,
  validateImagePaths,
} from "../validation.mjs";
import { ValidationError } from "../errors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.resolve(__dirname, "../../src/data/content.json");

async function makeTempRepo(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eyepsy-admin-test-"));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const data = JSON.parse(await fs.readFile(contentPath, "utf8"));
  for (const imagePath of collectImagePaths(data)) {
    const relative = imagePath.replace(/^\/images\//, "");
    const absolute = path.join(dir, "src/assets/images", relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, "test image");
  }

  return { dir, data };
}

test("valid content with existing images passes", async (t) => {
  const { dir, data } = await makeTempRepo(t);
  const result = await validateContent(JSON.stringify(data), {
    repoDir: dir,
    assetsDir: "src/assets/images",
  });
  assert.equal(result.site.brandName, data.site.brandName);
});

test("missing image files are rejected", async (t) => {
  const { dir, data } = await makeTempRepo(t);
  const missing = path.join(
    dir,
    "src/assets/images/certificates/ulyana/u1.webp",
  );
  await fs.rm(missing, { force: true });

  await assert.rejects(
    validateImagePaths(data, {
      repoDir: dir,
      assetsDir: "src/assets/images",
    }),
    ValidationError,
  );
});

test("image paths cannot escape the assets directory", async (t) => {
  const { dir, data } = await makeTempRepo(t);
  data.certificates.items[0].src = "/images/../secret.webp";

  await assert.rejects(
    validateImagePaths(data, {
      repoDir: dir,
      assetsDir: "src/assets/images",
    }),
    ValidationError,
  );
});

test("invalid JSON is rejected", () => {
  assert.throws(() => parseContentJson("{"), ValidationError);
});

test("missing required fields are rejected", () => {
  assert.throws(
    () => parseContentJson(JSON.stringify({ site: {} })),
    ValidationError,
  );
});
