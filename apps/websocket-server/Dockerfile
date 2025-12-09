# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace configuration first
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy only the lockfile
COPY pnpm-lock.yaml ./

# Copy shared packages (package.json and tsconfig only first for caching)
COPY packages/config/package.json packages/config/tsconfig.json ./packages/config/
COPY packages/database/package.json packages/database/tsconfig.json ./packages/database/
COPY packages/errors/package.json packages/errors/tsconfig.json ./packages/errors/
COPY packages/logger/package.json packages/logger/tsconfig.json ./packages/logger/
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/validation/package.json packages/validation/tsconfig.json ./packages/validation/

# Copy app package.json and tsconfig
COPY apps/websocket-server/package.json apps/websocket-server/tsconfig.json ./apps/websocket-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema for database package
COPY packages/database/prisma ./packages/database/prisma

# Generate Prisma client with retry and timeout handling
RUN pnpm --filter @clone/database prisma:generate || \
    (echo "Retrying Prisma generate..." && sleep 10 && pnpm --filter @clone/database prisma:generate) || \
    (echo "Final retry..." && sleep 20 && pnpm --filter @clone/database prisma:generate)

# Copy source files
COPY packages/config/src ./packages/config/src
COPY packages/database/src ./packages/database/src
COPY packages/errors/src ./packages/errors/src
COPY packages/logger/src ./packages/logger/src
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/validation/src ./packages/validation/src
COPY apps/websocket-server/src ./apps/websocket-server/src

# Build all dependencies using pnpm filter with dependencies
RUN pnpm --filter @clone/websocket-server... build

# Production stage
FROM node:22-slim

WORKDIR /app

# Install pnpm and openssl (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for workspace resolution
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/errors/package.json ./packages/errors/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY apps/websocket-server/package.json ./apps/websocket-server/

# Copy Prisma schema
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Copy built dist folders
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/errors/dist ./packages/errors/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/apps/websocket-server/dist ./apps/websocket-server/dist

# Install production dependencies only (ignore-scripts to skip husky install)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Generate Prisma client in production stage
# Install prisma CLI globally (avoids workspace: protocol issues), generate, then clean up
RUN npm install -g prisma@6 && \
    cd packages/database && \
    prisma generate && \
    npm uninstall -g prisma

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment
ENV NODE_ENV=production
ENV WEBSOCKET_PORT=8080

EXPOSE 8080

WORKDIR /app/apps/websocket-server
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
