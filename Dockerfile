# ==========================================
# IconVault Production Dockerfile
# Multi-stage build for React + Node.js + SQLite
# ==========================================

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native dependencies for better-sqlite3 and opentype font generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* ./client/
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies
RUN npm install --prefix client
RUN npm install --prefix server

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client (Vite) and server (TypeScript)
RUN npm run build --prefix client
RUN npm run build --prefix server

# Prune devDependencies in server
RUN cd server && npm prune --omit=dev

# ==========================================
# Runtime Stage
# ==========================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies for fonts / graphics
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

# Create data directory for SQLite and SVG asset storage
RUN mkdir -p /app/data/storage/projects

# Copy built server and production node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/src/db/schema.sql ./server/dist/db/schema.sql

# Copy built frontend client dist
COPY --from=builder /app/client/dist ./client/dist

# Expose default port
EXPOSE 3001

# Volume for database and asset persistence across container restarts
VOLUME ["/app/data"]

# Start server (Express serves both /api and built client SPA)
CMD ["node", "server/dist/index.js"]
