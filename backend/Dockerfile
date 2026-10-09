# Build context is the repository root (see docker-compose.yml) so the
# image can include database/migrations.

# ---- Install production dependencies ----
FROM node:22-alpine AS deps
# Toolchain for native modules (bcrypt) in case no prebuilt binary matches.
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime image ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/backend/node_modules backend/node_modules
COPY backend/package.json backend/package.json
COPY backend/src backend/src
COPY database/migrations database/migrations

# Run as the unprivileged user that ships with the Node image.
USER node
WORKDIR /app/backend
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO /dev/null http://127.0.0.1:5000/api/health || exit 1

# Apply idempotent migrations, then start the API.
CMD ["sh", "-c", "node src/scripts/migrate.js && exec node src/server.js"]
