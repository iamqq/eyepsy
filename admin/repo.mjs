import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { config } from "./config.mjs";
import { BuildError, ConflictError, PushError } from "./errors.mjs";

const execFileAsync = promisify(execFile);
const pendingPath = path.join(config.stateDir, "pending-push.json");
const depsMarker = path.join(config.stateDir, "deps.lock");

process.env.GIT_SSH_COMMAND = `ssh -i "${config.gitSshKeyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
process.env.GIT_AUTHOR_NAME = config.gitAuthorName;
process.env.GIT_AUTHOR_EMAIL = config.gitAuthorEmail;
process.env.GIT_COMMITTER_NAME = config.gitAuthorName;
process.env.GIT_COMMITTER_EMAIL = config.gitAuthorEmail;

function git(baseDir = config.repoDir) {
  return simpleGit({ baseDir });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, { cwd, timeout }) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    });
    return { stdout, stderr };
  } catch (error) {
    const wrapped = new Error(`Command failed: ${command} ${args.join(" ")}`);
    wrapped.stdout = error.stdout ?? "";
    wrapped.stderr = error.stderr ?? "";
    wrapped.exitCode = error.code;
    throw wrapped;
  }
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function refreshRepo() {
  if (config.dryRun && config.repoDir === config.repoRoot) return;
  await git().fetch(config.gitRemote, config.gitBranch);
  await git().reset(["--hard", `${config.gitRemote}/${config.gitBranch}`]);
}

export async function ensureDependencies() {
  if (config.dryRun && (await exists(path.join(config.repoDir, "node_modules")))) {
    return;
  }

  const lockPath = path.join(config.repoDir, "package-lock.json");
  if (!(await exists(lockPath))) return;

  const lockHash = await hashFile(lockPath);
  const previous = await fs.readFile(depsMarker, "utf8").catch(() => "");

  if (previous === lockHash && (await exists(path.join(config.repoDir, "node_modules")))) {
    return;
  }

  await run("npm", ["ci"], {
    cwd: config.repoDir,
    timeout: config.buildTimeoutMs,
  });
  await fs.writeFile(depsMarker, lockHash);
}

export async function ensureRepo() {
  if (!(await exists(config.repoDir))) {
    await fs.mkdir(path.dirname(config.repoDir), { recursive: true });
    await git().clone(config.repoUrl, config.repoDir, [
      "--branch",
      config.gitBranch,
      "--single-branch",
    ]);
  }

  const isRepo = await git().checkIsRepo().catch(() => false);
  if (!isRepo) {
    throw new Error(`${config.repoDir} is not a git repository.`);
  }

  await refreshRepo();
  await ensureDependencies();
}

export async function getBaseSha() {
  return (await git().revparse(["HEAD"])).trim();
}

export async function readContent() {
  return fs.readFile(path.join(config.repoDir, config.contentPath), "utf8");
}

export async function writeContent(text) {
  await fs.writeFile(path.join(config.repoDir, config.contentPath), text, "utf8");
}

export async function runBuild() {
  try {
    return await run("npm", ["run", "build"], {
      cwd: config.repoDir,
      timeout: config.buildTimeoutMs,
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new BuildError(
      "The site build failed. The change was not published.",
      output,
    );
  }
}

function isNonFastForward(error) {
  const message = String(error?.message ?? "");
  return /non-fast-forward|fetch first|rejected|failed to push some refs/i.test(
    message,
  );
}

export async function commitAndPush({ files, message }) {
  await git().add(files);
  const status = await git().status();

  if (status.isClean()) {
    return { commitSha: await getBaseSha(), unchanged: true };
  }

  await git().commit(message);
  const commitSha = (await git().revparse(["HEAD"])).trim();

  try {
    await git().push(config.gitRemote, config.gitBranch);
  } catch (error) {
    await setPendingPush({
      commitSha,
      message,
      createdAt: new Date().toISOString(),
      error: error.message,
    });
    throw new PushError(
      "The commit was created locally but the push failed. Retry the push from the dashboard.",
      { retryable: isNonFastForward(error), details: [error.message] },
    );
  }

  return { commitSha, unchanged: false };
}

export async function retryPendingPush() {
  const pending = await getPendingPush();
  if (!pending) {
    throw new ConflictError("There is no pending push to retry.");
  }

  try {
    await git().push(config.gitRemote, config.gitBranch);
  } catch (error) {
    throw new PushError(
      "The push failed again. Check the deploy key and network.",
      { retryable: false, details: [error.message] },
    );
  }

  await clearPendingPush();
  try {
    await refreshRepo();
  } catch (error) {
    console.warn("Post-push refresh failed:", error.message);
  }
  return pending;
}

export async function getPendingPush() {
  try {
    return JSON.parse(await fs.readFile(pendingPath, "utf8"));
  } catch {
    return null;
  }
}

export async function setPendingPush(info) {
  await fs.mkdir(config.stateDir, { recursive: true });
  await fs.writeFile(
    pendingPath,
    `${JSON.stringify(info, null, 2)}\n`,
    "utf8",
  );
}

export async function clearPendingPush() {
  await fs.rm(pendingPath, { force: true });
}

export function getCommitUrl(commitSha) {
  if (!config.githubRepoUrl || !commitSha) return null;
  return `${config.githubRepoUrl.replace(/\/+$/, "")}/commit/${commitSha}`;
}
