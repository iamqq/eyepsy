import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

dotenv.config({
  path: process.env.ADMIN_ENV_FILE || path.join(__dirname, ".env"),
});

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  throw new Error(
    `Node.js >=22.12 is required to run the admin service; found ${process.versions.node}.`,
  );
}

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function bool(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${name}: ${value}`);
  }
  return parsed;
}

function resolveFromRepo(value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

const dryRun = bool("DRY_RUN", false);
const sessionSecret = required("SESSION_SECRET");
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long.");
}
if (sessionSecret.startsWith("replace-") || sessionSecret.includes("replace-with")) {
  throw new Error(
    "SESSION_SECRET still contains the example value. Generate one with `openssl rand -hex 32`.",
  );
}

const adminPasswordHash = required("ADMIN_PASSWORD_HASH");
if (!adminPasswordHash.startsWith("$2")) {
  throw new Error(
    "ADMIN_PASSWORD_HASH does not look like a bcrypt hash. Run `npm run hash-password`.",
  );
}

const gitSshKeyPath = resolveFromRepo(
  optional("GIT_SSH_KEY_PATH", "admin/secrets/github_deploy_key"),
);

export const config = {
  isProduction: process.env.NODE_ENV === "production",
  host: optional("HOST", "0.0.0.0"),
  port: int("PORT", 3000),
  trustProxy: bool("TRUST_PROXY", process.env.NODE_ENV === "production"),
  cookieSecure: bool("COOKIE_SECURE", process.env.NODE_ENV === "production"),
  sessionSecret,
  sessionMaxAgeMs: int("SESSION_MAX_AGE_HOURS", 8) * 60 * 60 * 1000,
  adminUsername: required("ADMIN_USERNAME"),
  adminPasswordHash,
  repoRoot,
  repoDir: resolveFromRepo(optional("REPO_DIR", ".admin-data/repo")),
  stateDir: resolveFromRepo(optional("STATE_DIR", ".admin-data/state")),
  repoUrl: required("REPO_URL"),
  gitRemote: optional("GIT_REMOTE", "origin"),
  gitBranch: optional("GIT_BRANCH", "main"),
  gitSshKeyPath,
  gitAuthorName: optional("GIT_AUTHOR_NAME", "Content Admin"),
  gitAuthorEmail: optional("GIT_AUTHOR_EMAIL", "admin@ulianapsy.com"),
  githubRepoUrl: optional("GITHUB_REPO_URL", ""),
  uploadMaxMb: int("MAX_UPLOAD_MB", 10),
  buildTimeoutMs: int("BUILD_TIMEOUT_MS", 120000),
  dryRun,
  contentPath: "src/data/content.json",
  assetsDir: "src/assets/images",
  certificateDir: "src/assets/images/certificates/ulyana",
};

fs.mkdirSync(config.stateDir, { recursive: true });

if (!config.dryRun) {
  fs.accessSync(config.gitSshKeyPath, fs.constants.R_OK);
  const mode = fs.statSync(config.gitSshKeyPath).mode & 0o777;
  if (mode & 0o077) {
    console.warn(
      `Warning: deploy key ${config.gitSshKeyPath} is accessible by group or others (mode ${mode.toString(8)}).`,
    );
  }
}

export { repoRoot };
