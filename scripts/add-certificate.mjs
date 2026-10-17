#!/usr/bin/env node
/**
 * Add a certificate image + data entry without editing any files by hand.
 *
 * Usage:
 *   npm run cert -- <ulyana|anastasiya> <path-to-image> ["optional title"]
 *
 * Examples:
 *   npm run cert -- ulyana ~/Downloads/scan.jpg "Схема-терапия"
 *   npm run cert -- anastasiya ./emdr-2.png
 *
 * What it does:
 *   1. Converts the image to WebP (max 1920px) into
 *      src/assets/images/certificates/<person>/ so Astro's <Image /> component
 *      can optimise it at build time
 *   2. Appends an entry to src/data/certificates/<person>.json
 *
 * Run `npm run build` afterwards to publish.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [person, imagePath, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(" ").trim();
const PEOPLE = ["ulyana", "anastasiya"];

if (!person || !PEOPLE.includes(person) || !imagePath) {
  console.error(
    'Usage: npm run cert -- <ulyana|anastasiya> <path-to-image> ["optional title"]'
  );
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

const dataFile = path.join("src", "data", "certificates", `${person}.json`);
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

const items = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const src = `/images/certificates/${person}/${fileName}`;
items.push({ src, title: title || "Сертификат" });
fs.writeFileSync(dataFile, JSON.stringify(items, null, 2) + "\n");

console.log(`✓ Image saved   : ${path.join(outDir, fileName)}`);
console.log(`✓ Entry appended: ${src}`);
console.log(`  Data file     : ${dataFile}`);
console.log("  Run `npm run build` to publish.");
