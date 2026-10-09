# Multi-stage production build for PantryPal (Unraid / Docker / Compose)
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code and build frontend
COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy dependencies and built assets
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy dist built in stage 1, server files, and runtime configs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server-lib ./server-lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public

# Pre-install tsx locally for executing TypeScript server
RUN npm install -g tsx

# Create persistent data directory for Unraid appdata volume mount
RUN mkdir -p /app/data && chown -R node:node /app

# Persistent volume for Unraid (/mnt/user/appdata/pantrypal:/app/data)
VOLUME ["/app/data"]

USER node

EXPOSE 3000 3443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["tsx", "server.ts"]
