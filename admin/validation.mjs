import path from "node:path";
import fs from "node:fs/promises";
import { contentSchema } from "./schema.mjs";
import { ValidationError } from "./errors.mjs";

const ALLOWED_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif"]);

export function formatZodIssues(issues) {
  return issues.map((issue) => {
    const location = issue.path.length ? issue.path.join(".") : "(root)";
    return `${location}: ${issue.message}`;
  });
}

export function parseContentJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ValidationError("Invalid JSON", [error.message]);
  }

  const result = contentSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "Content validation failed",
      formatZodIssues(result.error.issues),
    );
  }

  return result.data;
}

export function collectImagePaths(data) {
  const paths = [data.site.logo, data.site.hero.image, data.person.photo];

  if (data.person.telegramChannel?.image) {
    paths.push(data.person.telegramChannel.image);
  }

  for (const item of data.certificates.items) {
    paths.push(item.src);
  }

  return [...new Set(paths)];
}

export async function validateImagePaths(
  data,
  { repoDir, assetsDir = "src/assets/images" },
) {
  const assetsRoot = path.resolve(repoDir, assetsDir);
  const errors = [];

  for (const imagePath of collectImagePaths(data)) {
    const relative = imagePath.replace(/^\/images\//, "");
    const absolute = path.resolve(assetsRoot, relative);

    if (absolute !== assetsRoot && !absolute.startsWith(`${assetsRoot}${path.sep}`)) {
      errors.push(`${imagePath}: path escapes the assets directory`);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(path.extname(absolute).toLowerCase())) {
      errors.push(`${imagePath}: unsupported image extension`);
      continue;
    }

    try {
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) {
        errors.push(`${imagePath}: not a file`);
      }
    } catch {
      errors.push(
        `${imagePath}: file not found at ${path.relative(repoDir, absolute)}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new ValidationError("Image path validation failed", errors);
  }
}

export async function validateContent(
  text,
  { repoDir, assetsDir = "src/assets/images" },
) {
  const data = parseContentJson(text);
  await validateImagePaths(data, { repoDir, assetsDir });
  return data;
}

export function stringifyContent(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}
