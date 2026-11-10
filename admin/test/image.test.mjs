import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { processCertificateImage } from "../image.mjs";
import { ValidationError } from "../errors.mjs";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nK0AAAAASUVORK5CYII=";

async function makeTempRepo(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eyepsy-admin-image-"));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}

function pngFile(name = "test image.png") {
  return {
    buffer: Buffer.from(PNG_1X1, "base64"),
    mimetype: "image/png",
    originalname: name,
  };
}

test("certificate images are converted to WebP with safe names", async (t) => {
  const dir = await makeTempRepo(t);
  const result = await processCertificateImage(pngFile(), {
    repoDir: dir,
    certificateDir: "src/assets/images/certificates/ulyana",
  });

  assert.equal(result.fileName, "test-image.webp");
  assert.equal(
    result.src,
    "/images/certificates/ulyana/test-image.webp",
  );

  const stat = await fs.stat(result.absolutePath);
  assert.equal(stat.isFile(), true);
  assert.ok(stat.size > 0);
});

test("duplicate certificate filenames get a numeric suffix", async (t) => {
  const dir = await makeTempRepo(t);
  const options = {
    repoDir: dir,
    certificateDir: "src/assets/images/certificates/ulyana",
  };

  const first = await processCertificateImage(pngFile(), options);
  const second = await processCertificateImage(pngFile(), options);

  assert.equal(first.fileName, "test-image.webp");
  assert.equal(second.fileName, "test-image-2.webp");
});

test("non-image uploads are rejected", async (t) => {
  const dir = await makeTempRepo(t);
  await assert.rejects(
    processCertificateImage(
      { ...pngFile(), mimetype: "text/plain" },
      {
        repoDir: dir,
        certificateDir: "src/assets/images/certificates/ulyana",
      },
    ),
    ValidationError,
  );
});

test("missing uploads are rejected", async (t) => {
  const dir = await makeTempRepo(t);
  await assert.rejects(
    processCertificateImage(null, {
      repoDir: dir,
      certificateDir: "src/assets/images/certificates/ulyana",
    }),
    ValidationError,
  );
});
