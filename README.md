# MeanStack-App

A posts dashboard with user accounts and image uploads. Anyone can read posts; signed-in users can create, edit and delete their own.

**Stack:** Angular 22 (standalone, signals, Material 3) · NestJS 11 · MongoDB · TypeScript everywhere · pnpm workspace · Docker

```
Browser ──► nginx (web, :8080) ──► /            static Angular app
                               ├─► /api/*       ──► NestJS API (:3000) ──► MongoDB
                               └─► /images/*    ──► NestJS API (uploaded files on a volume)
```

## Repository layout

```
apps/client   Angular client (lazy routes, signal store, typed reactive forms, Vitest, ESLint)
apps/server   NestJS API (Mongoose, JWT auth, validation, helmet, rate limiting, pino logs)
libs/shared   TypeScript types shared by the API and the client
```

## Prerequisites

- **Node** `^22.22.3` or `>=24.15` (Angular 22 requirement; `.nvmrc` says 24)
- **pnpm** 10 (`corepack enable` picks the version pinned in `package.json`)
- **Docker** (for MongoDB, and for the full-stack setup)

## Quick start (development)

```bash
pnpm install
cp .env.example .env            # then set JWT_SECRET to a long random string
docker compose up -d            # MongoDB on 127.0.0.1:27017

pnpm start:server               # API  -> http://localhost:3000/api
pnpm start                      # app  -> http://localhost:4200
```

The dev server proxies `/api` and `/images` to the API (`apps/client/proxy.conf.json`), so the client only ever uses relative URLs.

## Run the whole stack in Docker

```bash
cp .env.example .env            # set JWT_SECRET (compose refuses to start without it)
docker compose --profile app up --build -d
```

Open http://localhost:8080. Containers: `mongo`, `api` (runs as a non-root user, healthchecked via `/api/health`) and `web` (nginx serving the build and proxying `/api` and `/images`). Data lives in the `mongo-data` and `uploads` volumes.

Base images can be overridden, e.g. when Docker Hub rate-limits you or you use a private registry:
`docker compose --profile app build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:24-slim`.

## Configuration

All API settings are environment variables (validated at startup; the API refuses to start without the required ones).

| Variable        | Required | Default                 | Purpose                                                                  |
| --------------- | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `MONGODB_URI`   | yes      | –                       | MongoDB connection string                                                |
| `JWT_SECRET`    | yes      | –                       | Signs login tokens. Use a long random value and never commit it          |
| `PORT`          | no       | `3000`                  | API port                                                                 |
| `CLIENT_ORIGIN` | no       | `http://localhost:4200` | The only origin allowed by CORS                                          |
| `UPLOAD_DIR`    | no       | `uploads`               | Where uploaded images are stored                                         |
| `LOG_LEVEL`     | no       | `info`                  | pino log level                                                           |
| `TRUST_PROXY`   | no       | `0`                     | Reverse proxies in front of the API; set `1` behind nginx (compose does) |

Generate a secret with `openssl rand -base64 48`.

## API

Base path `/api`. Errors always have the shape `{ "message": "..." }`.

| Method | Path           | Auth | Description                                                                        |
| ------ | -------------- | ---- | ---------------------------------------------------------------------------------- |
| POST   | `/user/signup` | –    | `{ email, password }` → `201 { message, result: { id, email } }`                   |
| POST   | `/user/login`  | –    | `{ email, password }` → `{ token, expiresIn, userId }`; `401` on bad credentials   |
| GET    | `/posts`       | –    | `?page=&pagesize=` (max 100), newest first → `{ posts, maxPosts }`                 |
| GET    | `/posts/:id`   | –    | One post, `404` if missing, `400` for a malformed id                               |
| POST   | `/posts`       | yes  | multipart `title`, `content`, `image` (PNG/JPEG, ≤ 5 MB)                           |
| PUT    | `/posts/:id`   | yes  | multipart; send `imagePath` to keep the image or `image` to replace it; owner only |
| DELETE | `/posts/:id`   | yes  | Owner only                                                                         |
| GET    | `/health`      | –    | `200 { status, db }` while MongoDB is reachable, otherwise `503`                   |

Send the token as `Authorization: Bearer <token>`. Login/signup are limited to 20 requests per minute per client.

## Scripts

| Command             | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `pnpm start`        | Angular dev server                                           |
| `pnpm start:server` | API in watch mode (builds `libs/shared` first)               |
| `pnpm build`        | Production build of the client                               |
| `pnpm build:server` | Compile the API to `apps/server/dist`                        |
| `pnpm test`         | Client unit tests (Vitest)                                   |
| `pnpm test:server`  | API unit + integration tests (Jest, supertest, real MongoDB) |
| `pnpm test:e2e`     | Browser tests (Playwright); starts the API and client itself |
| `pnpm lint`         | Lint the client (angular-eslint)                             |
| `pnpm typecheck`    | Type-check the API and the e2e package                       |
| `pnpm format`       | Format everything with Prettier (`format:check` in CI)       |

A pre-commit hook (Husky + lint-staged) runs Prettier on staged files.

## Testing

- **Client** (`apps/client`, Vitest): auth service, interceptors, guard, image validator and the posts store.
- **API** (`apps/server`, Jest + supertest): every endpoint against a real MongoDB, including regression tests for the original login, update and delete bugs. Needs MongoDB: `docker compose up -d`, or point `TEST_MONGODB_URI` at another server. Each run uses a throwaway database.
- **End to end** (`e2e/`, Playwright): signup, login, logout, creating, editing and deleting posts with images, ownership rules and pagination, in a real browser. The first run needs a browser: `pnpm --filter @meanstack/e2e install:browsers` (or set `PW_CHROMIUM_PATH` to an existing Chromium). It uses its own database (`E2E_MONGODB_URI`, default `meanstack_e2e`) and wipes it on every run.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to the main branch and on pull requests:
formatting, lint, type-check, client tests and build; API tests against a MongoDB service container; Playwright tests; and a build of both Docker images.

## Production notes

- Serve the app over HTTPS in front of nginx (a load balancer or Caddy/Traefik); keep `TRUST_PROXY` equal to the number of proxies so rate limiting and image URLs see the real client address and protocol.
- Back up the `mongo-data` and `uploads` volumes. Uploaded images are stored on disk behind `StorageService`; switching to S3 or similar means swapping that one class.
- Logs are JSON on stdout (pino); `Authorization` and `Cookie` headers are redacted and `/api/health` is not logged.
- Rotate `JWT_SECRET` to sign everyone out.

## Project status

The project was modernised in phases: security fixes, a TypeScript API and pnpm workspace, a new Angular client, tests and CI, then Docker and docs. Possible next steps: refresh tokens in an httpOnly cookie, deleting image files together with their posts, storing image paths as relative URLs, and an OpenAPI spec.

## Authors

- **Yotam Achrak** – full-stack developer working with Angular, Node.js, PHP, ES6
- [GitHub](https://github.com/yotamach) · [LinkedIn](https://www.linkedin.com/in/yotam-achrak-717b6555)

## License

This project is licensed under the MIT License.
