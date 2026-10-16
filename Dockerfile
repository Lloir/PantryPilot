# Multi-stage production build for PantryPal (Unraid / Docker / Compose)
FROM node:22-alpine AS builder

RUN npm install -g bun@1.4.3

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and build frontend
COPY . .
RUN bun run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

RUN npm install -g bun@1.4.3 && apk add --no-cache tzdata

# Copy dependencies and built assets
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy dist built in stage 1, server files, and runtime configs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server-lib ./server-lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public

# Create persistent data directory for Unraid appdata volume mount
RUN mkdir -p /app/data && chown -R node:node /app

# Persistent volume for Unraid (/mnt/user/appdata/pantrypal:/app/data)
VOLUME ["/app/data"]

USER node

EXPOSE 3000 3443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "start"]
