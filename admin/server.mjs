import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "cookie-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import { config } from "./config.mjs";
import { AppError } from "./errors.mjs";
import { saveContent, addCertificate, retryPendingPush } from "./save.mjs";
import {
  ensureRepo,
  refreshRepo,
  getBaseSha,
  readContent,
  getPendingPush,
  getCommitUrl,
} from "./repo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", config.trustProxy ? 1 : false);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: null,
        upgradeInsecureRequests: null,
      },
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    name: "eyepsy_admin",
    keys: [config.sessionSecret],
    maxAge: config.sessionMaxAgeMs,
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  }),
);

app.use((req, res, next) => {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrf = req.session.csrf;
  res.locals.user = req.session.user || null;
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Try again later.",
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploadMaxMb * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new AppError("Only image uploads are allowed."));
  },
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function requireCsrf(req, res, next) {
  const token = req.body?._csrf;
  if (!token || token !== req.session.csrf) {
    return res.status(403).render("error", {
      title: "Forbidden",
      message: "Invalid form token. Reload the page and try again.",
    });
  }
  next();
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function viewData({
  contentText,
  contentData,
  baseSha,
  pendingPush,
  savedSha = null,
  savedUrl = null,
  dryRun = false,
  unchanged = false,
  error = null,
  certificateTitle = "",
}) {
  return {
    title: "Content admin",
    contentText,
    contentData,
    baseSha,
    pendingPush,
    savedSha,
    savedUrl,
    dryRun,
    unchanged,
    error,
    certificateTitle,
  };
}

async function loadDashboard({
  contentText,
  baseSha,
  savedSha = null,
  dryRun = false,
  unchanged = false,
  error = null,
  certificateTitle = "",
} = {}) {
  let text = contentText;
  let sha = baseSha;

  if (text === undefined) {
    try {
      await refreshRepo();
    } catch (error) {
      console.warn("Repository refresh failed:", error.message);
    }
    text = await readContent();
  }

  if (!sha) {
    sha = await getBaseSha();
  }

  const pendingPush = await getPendingPush();
  return viewData({
    contentText: text,
    contentData: safeParse(text),
    baseSha: sha,
    pendingPush,
    savedSha,
    savedUrl: savedSha ? getCommitUrl(savedSha) : null,
    dryRun,
    unchanged,
    error,
    certificateTitle,
  });
}

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", dryRun: config.dryRun });
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("login", { title: "Sign in", error: null, username: "" });
});

app.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const csrf = req.body?._csrf;
    if (!csrf || csrf !== req.session.csrf) {
      return res.status(403).render("login", {
        title: "Sign in",
        error: "Invalid form token. Reload and try again.",
        username: "",
      });
    }

    const username = typeof req.body.username === "string" ? req.body.username : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const usernameOk = username === config.adminUsername;
    const passwordOk = await bcrypt.compare(password, config.adminPasswordHash);

    if (!usernameOk || !passwordOk) {
      return res.status(401).render("login", {
        title: "Sign in",
        error: "Invalid username or password.",
        username,
      });
    }

    req.session = {
      user: config.adminUsername,
      csrf: crypto.randomBytes(32).toString("hex"),
    };
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

app.post("/logout", requireAuth, requireCsrf, (req, res) => {
  req.session = null;
  res.redirect("/login");
});

app.get("/", requireAuth, async (req, res, next) => {
  try {
    const savedSha = typeof req.query.saved === "string" ? req.query.saved : null;
    const data = await loadDashboard({
      savedSha,
      dryRun: req.query.dryRun === "1",
      unchanged: req.query.unchanged === "1",
    });
    res.render("dashboard", data);
  } catch (error) {
    next(error);
  }
});

app.post("/content", requireAuth, requireCsrf, async (req, res, next) => {
  const jsonText = typeof req.body.json === "string" ? req.body.json : "";
  const baseSha = typeof req.body.baseSha === "string" ? req.body.baseSha : "";

  try {
    const result = await saveContent({ jsonText, baseSha });
    const query = new URLSearchParams({ saved: result.commitSha });
    if (result.dryRun) query.set("dryRun", "1");
    if (result.unchanged) query.set("unchanged", "1");
    res.redirect(`/?${query.toString()}`);
  } catch (error) {
    if (!(error instanceof AppError)) {
      return next(error);
    }
    try {
      const data = await loadDashboard({
        contentText: jsonText,
        baseSha,
        error: {
          message: error.message,
          details: error.details ?? [],
          output: error.output ?? null,
        },
      });
      res.status(error.status).render("dashboard", data);
    } catch (renderError) {
      next(renderError);
    }
  }
});

app.post(
  "/certificates",
  requireAuth,
  upload.single("image"),
  requireCsrf,
  async (req, res, next) => {
    const title = typeof req.body.title === "string" ? req.body.title : "";
    const baseSha = typeof req.body.baseSha === "string" ? req.body.baseSha : "";

    try {
      const result = await addCertificate({
        title,
        file: req.file,
        baseSha,
      });
      const query = new URLSearchParams({ saved: result.commitSha });
      if (result.dryRun) query.set("dryRun", "1");
      res.redirect(`/?${query.toString()}`);
    } catch (error) {
      if (!(error instanceof AppError)) {
        return next(error);
      }
      try {
        const contentText = await readContent();
        const data = await loadDashboard({
          contentText,
          baseSha,
          certificateTitle: title,
          error: {
            message: error.message,
            details: error.details ?? [],
            output: error.output ?? null,
          },
        });
        res.status(error.status).render("dashboard", data);
      } catch (renderError) {
        next(renderError);
      }
    }
  },
);

app.post("/push", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const result = await retryPendingPush();
    const query = new URLSearchParams({ saved: result.commitSha });
    if (result.dryRun) query.set("dryRun", "1");
    res.redirect(`/?${query.toString()}`);
  } catch (error) {
    if (!(error instanceof AppError)) {
      return next(error);
    }
    try {
      const data = await loadDashboard({
        error: {
          message: error.message,
          details: error.details ?? [],
          output: error.output ?? null,
        },
      });
      res.status(error.status).render("dashboard", data);
    } catch (renderError) {
      next(renderError);
    }
  }
});

app.use(
  "/preview",
  requireAuth,
  express.static(path.join(config.repoDir, config.assetsDir)),
);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Not found",
    message: "Page not found.",
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `Image is too large. Maximum size is ${config.uploadMaxMb} MB.`
        : error.message;
    return res.status(400).render("error", {
      title: "Upload error",
      message,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).render("error", {
      title: "Request failed",
      message: error.message,
      details: error.details,
    });
  }

  console.error(error);
  res.status(500).render("error", {
    title: "Server error",
    message: config.isProduction
      ? "An unexpected error occurred."
      : error.message,
    details: config.isProduction ? [] : [error.stack],
  });
});

async function start() {
  await ensureRepo();
  const server = app.listen(config.port, config.host, () => {
    console.log(
      `eyepsy admin listening on http://${config.host}:${config.port}${config.dryRun ? " (dry run)" : ""}`,
    );
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Failed to start admin service:", error);
  process.exit(1);
});
