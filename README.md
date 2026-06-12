# VisaStore

VisaStore is a production-oriented Algerian e-commerce stack for phones, PCs, tablets, and accessories.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router
- Backend: Node.js, Express, TypeScript, Mongoose, Zod, Multer
- Database: MongoDB
- AI: Ollama local API
- Deployment: Docker, Docker Compose, Nginx

## Structure

```text
src/                  frontend app
backend/src/          backend app
backend/src/modules/  route modules
backend/src/models/   mongoose models
backend/src/seed/     seed data and seeder
```

## Environment

Root `.env` is used by Vite and Docker Compose. `backend/.env` is used for standalone backend development.

Root `.env`:

```env
VITE_API_BASE_URL=
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb://mongodb:27017/visastore
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost
BACKEND_URL=http://backend:4000
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1
UPLOAD_DIR=uploads
ADMIN_EMAIL=admin@visastore.dz
ADMIN_PASSWORD=ChangeThisAdminPassword123!
AFFILIATE_EMAIL=affiliate@visastore.dz
AFFILIATE_PASSWORD=ChangeThisAffiliatePassword123!
```

Standalone backend `backend/.env`:

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/visastore
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
UPLOAD_DIR=uploads
ADMIN_EMAIL=admin@visastore.dz
ADMIN_PASSWORD=ChangeThisAdminPassword123!
AFFILIATE_EMAIL=affiliate@visastore.dz
AFFILIATE_PASSWORD=ChangeThisAffiliatePassword123!
```

## Development

1. Install root dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
npm --prefix backend install
```

3. Copy env files:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

4. Start MongoDB and Ollama locally.

5. Run the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## Seed

The backend auto-seeds on startup. Manual seed:

```bash
npm --prefix backend run seed
```

Seed content:

- super admin
- affiliate demo account
- 58 Algerian wilayas
- categories
- brands
- sample products
- default website settings

The seeded admin and affiliate credentials come from your env values. If you keep the example values, use:

- Admin: `admin@visastore.dz` / `ChangeThisAdminPassword123!`
- Affiliate: `affiliate@visastore.dz` / `ChangeThisAffiliatePassword123!`

## Checks

```bash
npm run lint
npm --prefix backend run typecheck
npm run build
```

## Docker

```bash
docker compose up --build
```

Services:

- `frontend`
- `backend`
- `mongodb`
- `ollama`
- `nginx`

Nginx exposes port `80` and proxies `/api` and `/uploads` to the backend.

## VPS Deployment

1. Install Docker and Docker Compose.
2. Clone the repo.
3. Copy `.env.example` to `.env` and replace the example secret values.
4. Pull the Ollama model you want to use.
5. Run:

```bash
docker compose up -d --build
```

6. Put TLS and DNS in front of the Nginx container.

## Notes

- Checkout creates `PENDING_AI_CONFIRMATION` orders first.
- AI confirmation must complete before the order becomes `CONFIRMED`.
- Commission approval happens only for `DELIVERED` and `PICKED_UP`.
- Cancelled, returned, and failed orders reject commission.
