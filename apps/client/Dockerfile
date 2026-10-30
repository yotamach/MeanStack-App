# syntax=docker/dockerfile:1
# Build context is the repository root:  docker build -f apps/client/Dockerfile .

ARG NODE_IMAGE=node:24-slim
ARG NGINX_IMAGE=nginx:1.29-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY libs/shared/package.json libs/shared/
RUN pnpm install --frozen-lockfile --filter @meanstack/client...

COPY libs/shared libs/shared
COPY apps/client apps/client
RUN pnpm --filter @meanstack/shared build && pnpm --filter @meanstack/client build

FROM ${NGINX_IMAGE} AS runtime
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist/client/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
