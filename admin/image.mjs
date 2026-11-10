import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { ValidationError } from "./errors.mjs";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueFileName(dir, base) {
  let candidate = `${base}.webp`;
  let n = 1;

  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      candidate = `${base}-${++n}.webp`;
    } catch {
      return candidate;
    }
  }
}

export async function removeFile(filePath) {
  if (!filePath) return;
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Ignore cleanup failures; the original error is more useful.
  }
}

export async function processCertificateImage(
  file,
  { repoDir, certificateDir = "src/assets/images/certificates/ulyana" },
) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ValidationError("Certificate image is required.");
  }

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new ValidationError(
      "Unsupported image type. Use JPEG, PNG, WebP, or AVIF.",
    );
  }

  let buffer;
  try {
    buffer = await sharp(file.buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer();
  } catch (error) {
    throw new ValidationError("Could not process the image.", [error.message]);
  }

  const dir = path.resolve(repoDir, certificateDir);
  await fs.mkdir(dir, { recursive: true });

  const originalBase = path.basename(
    file.originalname || "sertifikat",
    path.extname(file.originalname || ""),
  );
  const base = slugify(originalBase) || "sertifikat";
  const fileName = await uniqueFileName(dir, base);
  const absolutePath = path.join(dir, fileName);
  await fs.writeFile(absolutePath, buffer);

  const relativeDir = certificateDir.replace(/^src\/assets\//, "");
  const src = `/${relativeDir}/${fileName}`;

  return { fileName, src, absolutePath };
}
