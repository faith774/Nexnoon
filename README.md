# Nexnoon – Live Online Learning Platform

Full-stack app: **nexnoon-backend** (Node/Express/MongoDB) + **nexnoon-frontend** (React/Vite).

## Quick start

### 1. MongoDB (Docker)

From this folder (`nexnoon/`):

```bash
docker compose up -d
```

That starts **`nexnoon-mongodb`** on `localhost:27017` with a persistent volume (`nexnoon_mongo_data`).

- Health: `docker compose ps`
- Logs: `docker compose logs -f mongodb`
- Stop: `docker compose down` (add `-v` to wipe data)

If port `27017` is already in use by another Mongo container (e.g. `worknoon-mongodb`), either:

```bash
docker stop worknoon-mongodb   # free the port
docker compose up -d           # start nexnoon-mongodb
```

…or keep the existing Mongo container — the backend still connects the same way as long as something Mongo is listening on `27017`.

### 2. Backend

```bash
cd nexnoon-backend
cp env.example .env   # if you do not already have .env
npm install
npm run dev
```

`MONGODB_URI` must be:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/nexnon
```

Backend connects to the Docker Mongo instance on boot (`src/config/db.ts`). Port **4000**. API base: `http://localhost:4000/v1`.

### 3. Frontend

```bash
cd nexnoon-frontend
cp env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**.

## Production

- Backend: set `NODE_ENV=production`, strong JWT secrets, production `MONGODB_URI`, `FRONTEND_URL`.
- Frontend: set `VITE_API_BASE_URL` to your API URL, `VITE_ENABLE_DEMO_MODE=false`.
