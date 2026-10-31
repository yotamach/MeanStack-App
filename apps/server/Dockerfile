# syntax=docker/dockerfile:1
# Build context is the repository root:  docker build -f apps/server/Dockerfile .

ARG NODE_IMAGE=node:24-slim

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo

# Manifests first so the dependency layer is cached until a package.json or the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY libs/shared/package.json libs/shared/
RUN pnpm install --frozen-lockfile --filter @meanstack/server...

COPY libs/shared libs/shared
COPY apps/server apps/server
RUN pnpm --filter @meanstack/shared build \
 && pnpm --filter @meanstack/server build \
 # A self-contained production tree: compiled code plus only the runtime dependencies.
 && pnpm --filter @meanstack/server deploy --legacy --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build /out ./
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
VOLUME /data/uploads
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
