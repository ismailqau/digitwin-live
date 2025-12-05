# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma) and pnpm
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9

# Copy workspace configuration first
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy only the lockfile
COPY pnpm-lock.yaml ./

# Copy shared packages (package.json only first for caching)
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/errors/package.json ./packages/errors/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/

# Copy tsconfig files for packages
COPY packages/config/tsconfig.json ./packages/config/
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/errors/tsconfig.json ./packages/errors/
COPY packages/logger/tsconfig.json ./packages/logger/
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/validation/tsconfig.json ./packages/validation/

# Copy app package.json and tsconfig
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/api-gateway/tsconfig.json ./apps/api-gateway/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema for database package
COPY packages/database/prisma ./packages/database/prisma

# Generate Prisma client
RUN pnpm --filter @clone/database prisma:generate

# Copy source files
COPY packages/config/src ./packages/config/src
COPY packages/database/src ./packages/database/src
COPY packages/errors/src ./packages/errors/src
COPY packages/logger/src ./packages/logger/src
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/validation/src ./packages/validation/src
COPY apps/api-gateway/src ./apps/api-gateway/src

# Build all packages in dependency order using pnpm filter with dependencies
RUN pnpm --filter @clone/api-gateway... build

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
COPY apps/api-gateway/package.json ./apps/api-gateway/

# Copy Prisma schema
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Copy built dist folders
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/errors/dist ./packages/errors/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist

# Install production dependencies (ignore-scripts to skip husky install)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Generate Prisma client in production stage
RUN cd packages/database && npx prisma@6 generate

# Create symlink for Prisma client at expected location
RUN mkdir -p /app/node_modules/.prisma && \
    mkdir -p /app/node_modules/@prisma && \
    cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/* /app/node_modules/.prisma/ 2>/dev/null || true && \
    cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client /app/node_modules/@prisma/ 2>/dev/null || true

# Set environment
ENV NODE_ENV=production
ENV API_GATEWAY_PORT=8080

EXPOSE 8080

WORKDIR /app/apps/api-gateway
CMD ["node", "dist/index.js"]
