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

# Copy shared packages (package.json only first for caching)
COPY packages/config/package.json ./packages/config/
COPY packages/errors/package.json ./packages/errors/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-types/package.json ./packages/shared-types/

# Copy service package.json
COPY services/face-processing-service/package.json ./services/face-processing-service/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/config ./packages/config
COPY packages/errors ./packages/errors
COPY packages/logger ./packages/logger
COPY packages/shared-types ./packages/shared-types
COPY services/face-processing-service ./services/face-processing-service

# Build shared packages
RUN pnpm --filter @clone/shared-types build
RUN pnpm --filter @clone/errors build
RUN pnpm --filter @clone/logger build
RUN pnpm --filter @clone/config build

# Build the service
RUN pnpm --filter @clone/face-processing-service build

# Production stage
FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy built packages
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/face-processing-service ./services/face-processing-service

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Set environment
ENV NODE_ENV=production
ENV FACE_PROCESSING_PORT=8080

EXPOSE 8080

WORKDIR /app/services/face-processing-service
CMD ["node", "dist/index.js"]
