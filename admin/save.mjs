import { config } from "./config.mjs";
import { audit } from "./audit.mjs";
import { ConflictError, ValidationError, PushError } from "./errors.mjs";
import { validateContent, stringifyContent } from "./validation.mjs";
import { processCertificateImage, removeFile } from "./image.mjs";
import {
  ensureRepo,
  getBaseSha,
  readContent,
  writeContent,
  runBuild,
  commitAndPush,
  refreshRepo,
  retryPendingPush as retryGitPush,
  getPendingPush,
  clearPendingPush,
  getCommitUrl,
} from "./repo.mjs";

let saveInProgress = false;

function acquire() {
  if (saveInProgress) {
    throw new ConflictError("Another save is already in progress. Try again shortly.");
  }
  saveInProgress = true;
}

function release() {
  saveInProgress = false;
}

function assertBaseSha(baseSha, currentSha) {
  if (!baseSha || baseSha !== currentSha) {
    throw new ConflictError(
      "Content changed on GitHub. Reload the page and reapply your edits.",
    );
  }
}

async function withRetry(operation) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PushError && error.retryable && attempt === 0) {
        await clearPendingPush();
        continue;
      }
      throw error;
    }
  }
  throw new Error("Save failed after retry.");
}

async function assertNoPendingPush() {
  const pending = await getPendingPush();
  if (pending) {
    throw new ConflictError(
      `A previous commit is waiting to be pushed (${pending.commitSha}). Retry the push first.`,
    );
  }
}

async function postPushRefresh() {
  try {
    await refreshRepo();
  } catch (error) {
    console.warn("Post-push refresh failed:", error.message);
  }
}

export async function saveContent({ jsonText, baseSha }) {
  acquire();
  try {
    await assertNoPendingPush();

    return await withRetry(async () => {
      await ensureRepo();
      const currentSha = await getBaseSha();
      assertBaseSha(baseSha, currentSha);

      const data = await validateContent(jsonText, {
        repoDir: config.repoDir,
        assetsDir: config.assetsDir,
      });
      const previous = await readContent();
      await writeContent(stringifyContent(data));

      try {
        const build = await runBuild();

        if (config.dryRun) {
          await writeContent(previous);
          await audit("content.save.dry-run", { baseSha: currentSha });
          return {
            commitSha: currentSha,
            commitUrl: null,
            dryRun: true,
            unchanged: true,
            build,
          };
        }

        const result = await commitAndPush({
          files: [config.contentPath],
          message: "Update content via admin",
        });
        await postPushRefresh();
        await audit("content.save", {
          commitSha: result.commitSha,
          baseSha: currentSha,
          unchanged: result.unchanged,
        });
        return {
          commitSha: result.commitSha,
          commitUrl: getCommitUrl(result.commitSha),
          dryRun: false,
          unchanged: result.unchanged,
          build,
        };
      } catch (error) {
        await writeContent(previous);
        throw error;
      }
    });
  } finally {
    release();
  }
}

export async function addCertificate({ title, file, baseSha }) {
  acquire();
  try {
    const cleanTitle = (title || "").trim();
    if (!cleanTitle) {
      throw new ValidationError("Certificate title is required.");
    }
    if (cleanTitle.length > 200) {
      throw new ValidationError("Certificate title must be 200 characters or less.");
    }
    if (!file) {
      throw new ValidationError("Certificate image is required.");
    }

    await assertNoPendingPush();

    return await withRetry(async () => {
      await ensureRepo();
      const currentSha = await getBaseSha();
      assertBaseSha(baseSha, currentSha);

      const previous = await readContent();
      const data = await validateContent(previous, {
        repoDir: config.repoDir,
        assetsDir: config.assetsDir,
      });
      const image = await processCertificateImage(file, {
        repoDir: config.repoDir,
        certificateDir: config.certificateDir,
      });

      try {
        data.certificates.items.push({ src: image.src, title: cleanTitle });
        await writeContent(stringifyContent(data));
        const build = await runBuild();

        if (config.dryRun) {
          await writeContent(previous);
          await removeFile(image.absolutePath);
          await audit("certificate.add.dry-run", {
            baseSha: currentSha,
            src: image.src,
            title: cleanTitle,
          });
          return {
            commitSha: currentSha,
            commitUrl: null,
            dryRun: true,
            unchanged: true,
            build,
          };
        }

        const result = await commitAndPush({
          files: [
            config.contentPath,
            `${config.certificateDir}/${image.fileName}`,
          ],
          message: `Add certificate: ${cleanTitle}`,
        });
        await postPushRefresh();
        await audit("certificate.add", {
          commitSha: result.commitSha,
          baseSha: currentSha,
          src: image.src,
          title: cleanTitle,
          unchanged: result.unchanged,
        });
        return {
          commitSha: result.commitSha,
          commitUrl: getCommitUrl(result.commitSha),
          dryRun: false,
          unchanged: result.unchanged,
          build,
        };
      } catch (error) {
        await writeContent(previous);
        await removeFile(image.absolutePath);
        throw error;
      }
    });
  } finally {
    release();
  }
}

export async function retryPendingPush() {
  acquire();
  try {
    const pending = await retryGitPush();
    await audit("content.push.retry", { commitSha: pending.commitSha });
    return {
      commitSha: pending.commitSha,
      commitUrl: getCommitUrl(pending.commitSha),
      dryRun: config.dryRun,
      unchanged: false,
    };
  } finally {
    release();
  }
}
