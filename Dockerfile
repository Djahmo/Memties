FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@11.25.0
WORKDIR /app/backend
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
COPY --from=build --chown=node:node /app/backend/ ./
COPY --from=build --chown=node:node /app/frontend/dist/ /app/frontend/dist/
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
