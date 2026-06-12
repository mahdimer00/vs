# Deployment guide

- Frontend: Netlify, domain `visadz.store`
- Backend + database: OVH VPS (Linux), IP `51.38.177.166`, domain `api.visadz.store`
- Order alerts: Telegram bot message on every new order

## 1. DNS

In your domain registrar / OVH DNS zone for `visadz.store`, add:

| Type | Name | Value |
| ---- | ---- | ----- |
| A    | api  | 51.38.177.166 |

Keep `visadz.store` / `www` pointing at Netlify (Netlify gives you the records when you add the custom domain).

## 2. Telegram bot setup

1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the **bot token**.
2. Send any message to your new bot (or add it to a group).
3. Get your chat id:
   - Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser after sending the message.
   - Copy the `chat.id` value (use the group id if it's a group).
4. Save both values — you'll set them as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` on the backend.

A Telegram message is now sent automatically whenever a customer places a new order (see `backend/src/utils/telegram.ts`).

## 3. Backend on the OVH VPS

SSH into `51.38.177.166`.

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### Get the code

```bash
git clone <your-repo-url> visastore
cd visastore
```

### Configure environment

Create `.env` in the project root (used by `docker-compose.backend.yml`):

```env
MONGO_URI=mongodb://mongodb:27017/visastore
JWT_SECRET=<generate a long random string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://visadz.store
BACKEND_URL=https://api.visadz.store
UPLOAD_DIR=uploads
ADMIN_EMAIL=admin@visastore.dz
ADMIN_PASSWORD=<strong password>
AFFILIATE_EMAIL=affiliate@visastore.dz
AFFILIATE_PASSWORD=<strong password>
TELEGRAM_BOT_TOKEN=<from step 2>
TELEGRAM_CHAT_ID=<from step 2>
```

### Start the stack

```bash
docker compose -f docker-compose.backend.yml up -d --build
```

This starts:
- `backend` (Express API on port 4000, internal only)
- `mongodb` (database, internal only)
- `caddy` (reverse proxy on ports 80/443, auto HTTPS for `api.visadz.store` via Let's Encrypt)

Caddy automatically requests a TLS certificate for `api.visadz.store` the first time it starts — make sure DNS (step 1) is already pointing at the server before you start it.

To enable the AI (Ollama) confirmation feature, also start the `ai` profile (needs ~4-8GB RAM):

```bash
docker compose -f docker-compose.backend.yml --profile ai up -d
```

### Verify

```bash
curl https://api.visadz.store/api/categories
```

### Updating after future changes

```bash
git pull
docker compose -f docker-compose.backend.yml up -d --build
```

## 4. Frontend on Netlify

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project** → select the repo.
3. Build settings (already defined in `netlify.toml`):
   - Build command: `npx vite build`
   - Publish directory: `dist`
4. Add environment variable:
   - `VITE_API_BASE_URL` = `https://api.visadz.store`
5. Deploy. Then go to **Domain management → Add custom domain** → enter `visadz.store` (and `www.visadz.store`), and follow Netlify's DNS instructions.

`netlify.toml` already includes an SPA redirect (`/* -> /index.html`) so React Router routes work on refresh/direct links.

## 5. Smoke test

1. Visit `https://visadz.store` — storefront loads.
2. Visit `https://visadz.store/admin` — log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. Place a test order from the storefront → check the Telegram chat receives the order alert.
4. In the admin panel, create a product with multiple images and variants, confirm it appears on the storefront.
