# eyepsy content admin

A small authenticated web service for the content manager. It exposes one page
with two forms:

1. **Add certificate** — title + image upload. The server converts the image to
   WebP, appends an entry to `certificates.items`, validates the result, runs the
   site build, and publishes the change.
2. **Edit JSON** — a textarea with the current `src/data/content.json`. The
   server parses and validates it, checks every referenced image exists, runs the
   site build, and publishes only if everything passes.

Certificate deletion is done by removing the corresponding object from
`certificates.items` in the JSON form and saving.

## Requirements

- Node.js >= 22.12
- `git` and `ssh` available on the host
- A write-enabled GitHub deploy key for the repository
- Nginx Proxy Manager (or another reverse proxy) for public HTTPS access

## Quick start (local dry run)

```bash
cd admin
npm install
cp .env.example .env
npm run hash-password
```

Put the resulting hash into `ADMIN_PASSWORD_HASH` in `admin/.env`. Also set a
random `SESSION_SECRET`, for example:

```bash
openssl rand -hex 32
```

The example `.env` uses `REPO_DIR=.` and `DRY_RUN=true`, so the service operates
on the repository itself and validates changes without committing or pushing.

```bash
npm run dev
```

Open <http://127.0.0.1:3000>.

> `npm run dev`, `npm run start:node22`, and `npm test` use
> `npx node@22.23.4`, so they also work when the system Node is older than
> 22.12. The plain `npm start` script assumes the system Node is already 22.12+;
> the systemd unit is intended for a host with Node 22 installed.

> Do not use `REPO_DIR=.` with `DRY_RUN=false`: the service performs
> `git fetch` + `git reset --hard` before each save. Production should use a
> dedicated clone such as `/var/lib/eyepsy-admin/repo`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Random string of at least 32 characters. |
| `ADMIN_USERNAME` | yes | Content-manager login. |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash from `npm run hash-password`. |
| `REPO_URL` | yes | Git remote, e.g. `git@github.com:iamqq/eyepsy.git`. |
| `REPO_DIR` | yes | Checkout used for the build and commit. Defaults to `.admin-data/repo` locally. |
| `STATE_DIR` | no | Pending-push and dependency markers. Defaults to `.admin-data/state`. |
| `GIT_REMOTE` | no | Defaults to `origin`. |
| `GIT_BRANCH` | no | Defaults to `main`. |
| `GIT_SSH_KEY_PATH` | yes | Deploy key path. Not required when `DRY_RUN=true` and the key is not used. |
| `GIT_AUTHOR_NAME` | no | Commit author name. |
| `GIT_AUTHOR_EMAIL` | no | Commit author email. |
| `GITHUB_REPO_URL` | no | Used for “Open commit” links, e.g. `https://github.com/iamqq/eyepsy`. |
| `HOST` | no | Defaults to `0.0.0.0`. Use `127.0.0.1` for local-only access. |
| `PORT` | no | Defaults to `3000`. |
| `TRUST_PROXY` | no | Set to `1` behind Nginx Proxy Manager. |
| `COOKIE_SECURE` | no | Set to `true` behind HTTPS. |
| `SESSION_MAX_AGE_HOURS` | no | Defaults to `8`. |
| `MAX_UPLOAD_MB` | no | Certificate image limit. Defaults to `10`. |
| `BUILD_TIMEOUT_MS` | no | Build timeout. Defaults to `120000`. |
| `DRY_RUN` | no | Validate and build without committing or pushing. |

## Deploy key

Generate a dedicated key:

```bash
mkdir -p admin/secrets
ssh-keygen -t ed25519 -C "eyepsy-admin" -f admin/secrets/github_deploy_key -N ""
```

Add `admin/secrets/github_deploy_key.pub` to the GitHub repository under
**Settings → Deploy keys**, with **Allow write access** enabled.

The private key must be readable by the service user. Never commit
`admin/secrets/` (it is gitignored).

## Save gate

Every save performs the same server-side checks:

1. Reject stale edits by comparing the submitted base SHA with the current
   `main` HEAD.
2. Parse the JSON and validate it against [`schema.mjs`](schema.mjs).
3. Check every image path exists under `src/assets/images/` and cannot escape
   that directory.
4. Write the change into the dedicated checkout.
5. Run `npm run build` in the checkout.
6. If the build fails, restore the previous content and remove any uploaded
   image.
7. Stage only `src/data/content.json` and the uploaded image, commit, and push.
8. If the push fails, keep the commit and show a **Retry push** action.

## Production: systemd

Create the service user and directories:

```bash
sudo useradd --system --create-home --home-dir /var/lib/eyepsy-admin --shell /usr/sbin/nologin eyepsy-admin
sudo -u eyepsy-admin mkdir -p /var/lib/eyepsy-admin/.ssh
sudo chmod 700 /var/lib/eyepsy-admin/.ssh
sudo mkdir -p /etc/eyepsy-admin
```

Create the deploy key, add the public key to GitHub with write access, and
install the private key:

```bash
ssh-keygen -t ed25519 -C "eyepsy-admin" -f github_deploy_key -N ""
# Add github_deploy_key.pub in GitHub → Settings → Deploy keys (allow write access)
sudo install -m 600 -o eyepsy-admin -g eyepsy-admin github_deploy_key /etc/eyepsy-admin/deploy_key
```

Clone the repository through the deploy key and install dependencies:

```bash
sudo -u eyepsy-admin env HOME=/var/lib/eyepsy-admin \
  GIT_SSH_COMMAND='ssh -i /etc/eyepsy-admin/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' \
  git clone git@github.com:iamqq/eyepsy.git /var/lib/eyepsy-admin/repo
sudo -u eyepsy-admin env HOME=/var/lib/eyepsy-admin sh -lc 'cd /var/lib/eyepsy-admin/repo && npm ci'
sudo -u eyepsy-admin env HOME=/var/lib/eyepsy-admin sh -lc 'cd /var/lib/eyepsy-admin/repo/admin && npm ci'
```

Create the environment file:

```bash
sudo install -m 600 -o root -g root \
  /var/lib/eyepsy-admin/repo/admin/deploy/admin.env.example \
  /etc/eyepsy-admin/admin.env
sudo editor /etc/eyepsy-admin/admin.env
```

Set `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, and any host-specific paths. Then
install the unit:

```bash
sudo cp admin/deploy/eyepsy-admin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now eyepsy-admin
sudo systemctl status eyepsy-admin
```

Logs go to journald:

```bash
journalctl -u eyepsy-admin -f
```

Health check:

```bash
curl http://127.0.0.1:3000/healthz
```

## Nginx Proxy Manager

The service binds to `0.0.0.0:3000` by default so NPM on another server can
reach it.

1. In NPM, create a **Proxy Host**.
2. Forward hostname/IP: the admin server's private address.
3. Forward port: `3000`.
4. Enable **Block Common Exploits**.
5. On the SSL tab, request a certificate and enable **Force SSL**.
6. Restrict port `3000` in the admin server firewall so only the NPM server can
   connect.

NPM terminates TLS, so keep `TRUST_PROXY=1` and `COOKIE_SECURE=true` in
production.

## Content-manager usage

1. Sign in at the admin URL.
2. Use **Добавить сертификат** to upload an image and title.
3. Use **Редактировать JSON** for any other copy changes.
4. To remove a certificate, delete its object from `certificates.items` in the
   JSON editor and save.
5. If a commit cannot be pushed, use **Повторить отправку**.

Deleting a certificate row removes it from the gallery but leaves the image file
in `src/assets/images/certificates/ulyana/`. Remove that file separately if
needed.

## Tests

```bash
cd admin
npm test
```

The tests cover the content schema, image-path validation, and the certificate
WebP conversion/naming pipeline.
