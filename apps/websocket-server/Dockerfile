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
COPY packages/errors/package.json packages/errors/tsconfig.json ./packages/errors/
COPY packages/logger/package.json packages/logger/tsconfig.json ./packages/logger/
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/validation/package.json packages/validation/tsconfig.json ./packages/validation/

# Copy app package.json and tsconfig
COPY apps/websocket-server/package.json apps/websocket-server/tsconfig.json ./apps/websocket-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/config/src ./packages/config/src
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

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for workspace resolution
COPY packages/config/package.json ./packages/config/
COPY packages/errors/package.json ./packages/errors/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY apps/websocket-server/package.json ./apps/websocket-server/

# Copy built dist folders
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/errors/dist ./packages/errors/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/apps/websocket-server/dist ./apps/websocket-server/dist

# Install production dependencies only (ignore-scripts to skip husky install)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Set environment
ENV NODE_ENV=production
ENV WEBSOCKET_PORT=8080

EXPOSE 8080

WORKDIR /app/apps/websocket-server
CMD ["node", "dist/index.js"]
