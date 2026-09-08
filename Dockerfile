FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@11.25.0
WORKDIR /app/backend

FROM base AS production-dependencies
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build
WORKDIR /app/backend
RUN pnpm build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 SERVE_FRONTEND=true
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/backend/package.json ./
COPY --from=build --chown=node:node /app/backend/dist/ ./dist/
COPY --from=build --chown=node:node /app/backend/drizzle/ ./drizzle/
COPY --from=production-dependencies --chown=node:node /app/backend/node_modules/ ./node_modules/
COPY --from=build --chown=node:node /app/frontend/dist/ /app/frontend/dist/
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
