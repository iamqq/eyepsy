/**
 * Image asset access layer.
 *
 * Content lives in JSON files and references images by their public-style path
 * (e.g. `/images/team/ulyana.webp`). To let Astro's `<Image />` component
 * optimise those images (resize, modern formats, responsive `srcset`) the files
 * must be imported from `src/assets/` rather than served verbatim from
 * `public/`.
 *
 * This module bridges the two: it eagerly imports every image under
 * `src/assets/` and exposes a lookup that turns a public-style path into the
 * imported `ImageMetadata` object expected by `<Image />`.
 */
import type { ImageMetadata } from "astro";

const assets = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/**/*.{webp,png,jpg,jpeg,avif}",
  { eager: true },
);

/**
 * Resolve a public-style image path (e.g. `/images/team/ulyana.webp`) to the
 * imported asset under `src/assets/` so it can be passed to `<Image />`.
 */
export function imageAsset(publicPath: string): ImageMetadata {
  const key = `../assets${publicPath}`;
  const mod = assets[key];
  if (!mod) {
    throw new Error(
      `Image asset not found for "${publicPath}" (looked up "${key}"). ` +
        `Move the file into src/assets${publicPath} to use it with <Image />.`,
    );
  }
  return mod.default;
}
