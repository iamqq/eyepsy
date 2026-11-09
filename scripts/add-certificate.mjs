#!/usr/bin/env node
/**
 * Add a certificate image + data entry without editing any files by hand.
 *
 * Usage:
 *   npm run cert -- ulyana <path-to-image> ["optional title"]
 *
 * Example:
 *   npm run cert -- ulyana ~/Downloads/scan.jpg "Схема-терапия"
 *
 * What it does:
 *   1. Converts the image to WebP (max 1920px) into
 *      src/assets/images/certificates/<person>/ so Astro's <Image /> component
 *      can optimise it at build time
 *   2. Appends an entry to src/data/content.json (certificates.items)
 *
 * Run `npm run build` afterwards to publish.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [person, imagePath, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(" ").trim();
const PEOPLE = ["ulyana"];

if (!person || !PEOPLE.includes(person) || !imagePath) {
  console.error(
    'Usage: npm run cert -- ulyana <path-to-image> ["optional title"]'
  );
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

const dataFile = path.join("src", "data", "content.json");
const outDir = path.join("src", "assets", "images", "certificates", person);

if (!fs.existsSync(dataFile)) {
  console.error(`Data file not found: ${dataFile}`);
  process.exit(1);
}

// Build a web-safe slug from the original filename.
let base = path
  .basename(imagePath)
  .replace(/\.[^.]+$/, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
if (!base) base = "sertifikat";

fs.mkdirSync(outDir, { recursive: true });

// Avoid overwriting an existing image.
let fileName = `${base}.webp`;
let n = 1;
while (fs.existsSync(path.join(outDir, fileName))) {
  fileName = `${base}-${++n}.webp`;
}

await sharp(imagePath, { failOn: "none" })
  .resize({ width: 1920, withoutEnlargement: true })
  .webp({ quality: 82, effort: 5 })
  .toFile(path.join(outDir, fileName));

const content = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const src = `/images/certificates/${person}/${fileName}`;
content.certificates.items.push({
  src,
  title: title || content.certificates.fallbackTitle,
});
fs.writeFileSync(dataFile, JSON.stringify(content, null, 2) + "\n");

console.log(`✓ Image saved   : ${path.join(outDir, fileName)}`);
console.log(`✓ Entry appended: ${src}`);
console.log(`  Data file     : ${dataFile}`);
console.log("  Run `npm run build` to publish.");
