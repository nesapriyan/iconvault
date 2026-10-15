# 🚀 Publishing IconVault to Cloud Platforms

IconVault is a full-stack application (React 18 + Vite frontend and Express Node.js backend with SQLite + asset storage). Because Express serves the compiled frontend in production, it deploys as a **unified, single-service web application**.

---

## Recommended: Deploying to Render.com (Easiest & Fastest)

Render offers free SSL, custom domains, and persistent disks for SQLite databases.

### Step 1: Push code to GitHub / GitLab
If you haven't initialized a repository yet:
```bash
cd iconvault
git init
git add .
git commit -m "Initial commit for IconVault"
```
Create a new repo on GitHub (e.g. `iconvault`) and push:
```bash
git remote add origin https://github.com/<your-username>/iconvault.git
git branch -M main
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Blueprint** (or **Web Service**).
2. Connect your GitHub repository.
3. If using **Blueprint**: Render will automatically detect [`render.yaml`](./render.yaml) and configure everything (including the persistent disk).
4. If setting up manually as a **Web Service**:
   - **Environment**: Node
   - **Build Command**: `npm install --prefix client && npm install --prefix server && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `DATA_DIR`: `/var/data`
   - **Disks** (under Advanced):
     - **Name**: `iconvault-data`
     - **Mount Path**: `/var/data`
     - **Size**: `1 GB` (or more)

Render will build and give you a live HTTPS URL like `https://iconvault.onrender.com`!

---

## Option 2: Deploying to Railway.app

Railway provides instant container deployment with persistent volumes.

1. Go to [railway.app](https://railway.app) and click **New Project** → **Deploy from GitHub repo**.
2. Select your `iconvault` repository.
3. In your Railway service settings:
   - Click **Add Volume** (Mount path: `/app/data`).
   - In **Variables**, add:
     - `NODE_ENV`: `production`
     - `DATA_DIR`: `/app/data`
4. Click **Generate Domain** under Networking.
5. Your application is live!

---

## Option 3: Deploying to Fly.io

1. Install Fly CLI: `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`)
2. Log in: `fly auth login`
3. In `iconvault/`:
   ```bash
   # Create persistent volume for database and icon storage
   fly volumes create iconvault_data --size 1 --region iad

   # Deploy application
   fly deploy
   ```
4. Run `fly open` to access your live site!

---

## Option 4: Local Docker Run (Test Production Locally)

To verify the production build locally with Docker before pushing:

```bash
cd iconvault

# Build Docker image
docker build -t iconvault:latest .

# Run container with persistent data directory
docker run -d \
  --name iconvault \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  iconvault:latest

# Open in browser:
# http://localhost:3001
```

---

## Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3001` | The HTTP port the server listens on (auto-assigned by Render/Railway/Fly) |
| `NODE_ENV` | `development` | Set to `production` for optimized static asset serving |
| `DATA_DIR` | `./` | Path to persistent storage mount (stores `iconvault.sqlite` and uploaded SVGs/fonts) |
| `CORS_ORIGIN`| `*` | Allowed origins (can be set to your production domain) |
